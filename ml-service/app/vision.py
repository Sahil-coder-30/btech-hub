"""Vision checks that run before OCR, plus light document understanding after it."""

import base64
import io
import re
from collections import Counter

import cv2
import httpx
import numpy as np
from PIL import Image

from .config import get_settings

SUBJECT_CODE = re.compile(r"\b(B[A-Z]{2}\d{3}|K[A-Z]{2}\d{3}|BOE\d{3})\b")
DEVANAGARI = re.compile(r"[ऀ-ॿ]")
LATIN = re.compile(r"[A-Za-z]")
STOPWORDS = set(
    "the a an of and or to in on for with by is are was were be this that it as at from which what how why when "
    "explain write define discuss any one part following marks attempt question questions unit note".split()
)


def image_quality(image: Image.Image) -> dict:
    """Blur, brightness and resolution checks so users can retake bad photos before uploading."""
    gray = np.array(image.convert("L"))
    h, w = gray.shape
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    contrast = float(gray.std())  # printed pages are bright but high contrast, glare is bright and flat
    issues = []
    if min(h, w) < 600:
        issues.append("Low resolution. Move closer or use a higher quality photo.")
    if sharpness < 60:
        issues.append("Image looks blurry. Hold the phone steady and retake.")
    if brightness < 70 and contrast < 35:
        issues.append("Image is quite dark. Use better lighting.")
    if brightness > 225 and contrast < 25:
        issues.append("Image is washed out. Avoid flash glare.")
    return {
        "width": w,
        "height": h,
        "sharpness": round(sharpness, 1),
        "brightness": round(brightness, 1),
        "contrast": round(contrast, 1),
        "dark_background": brightness < 110,
        "ok": not issues,
        "issues": issues,
    }


def detect_language(text: str) -> str:
    deva, latin = len(DEVANAGARI.findall(text)), len(LATIN.findall(text))
    if deva and latin:
        return "en+hi" if min(deva, latin) / max(deva, latin) > 0.15 else ("hi" if deva > latin else "en")
    return "hi" if deva else "en"


def classify_document(text: str) -> str:
    """Rough material type from the text, used to prefill the upload form."""
    t = text.lower()
    pyq_hits = sum(k in t for k in ["attempt any", "roll no", "time:", "max. marks", "total marks", "printed pages", "paper id", "section a"])
    if pyq_hits >= 2:
        return "pyq"
    if "important question" in t or "imp question" in t:
        return "imp_question"
    return "notes"


def keywords(text: str, top: int = 12) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z\-]{3,}", text.lower())
    counts = Counter(w for w in words if w not in STOPWORDS)
    return [w for w, _ in counts.most_common(top)]


def analyse_text(text: str) -> dict:
    codes = [c for c, _ in Counter(SUBJECT_CODE.findall(text)).most_common(5)]
    return {
        "language": detect_language(text),
        "suggested_type": classify_document(text),
        "subject_codes": codes,
        "keywords": keywords(text),
        "characters": len(text),
        "words": len(text.split()),
    }


def gemini_vision_ocr(image: Image.Image) -> str | None:
    """Fallback for pages local OCR cannot read well, such as handwriting. Needs GEMINI_API_KEY."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG", quality=85)
    body = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(buf.getvalue()).decode()}},
                {"text": "Transcribe all text on this page in reading order. Keep headings and lists. "
                         "Write formulas in LaTeX. Output only the transcription, no commentary."},
            ]
        }]
    }
    try:
        res = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent",
            headers={"x-goog-api-key": settings.gemini_api_key},
            json=body,
            timeout=120,
        )
        res.raise_for_status()
        parts = res.json()["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts).strip() or None
    except Exception:
        return None
