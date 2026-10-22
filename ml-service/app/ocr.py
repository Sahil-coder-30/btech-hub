"""Local OCR with RapidOCR (PaddleOCR models running on ONNX Runtime, CPU only, no API cost)."""

import re
import threading
from dataclasses import dataclass

import cv2
import numpy as np
import wordninja
from PIL import Image

_engine = None
_init_lock = threading.Lock()
_run_lock = threading.Lock()  # ONNX sessions are not shared across threads here


def engine():
    """Loads the OCR models once."""
    global _engine
    if _engine is None:
        with _init_lock:
            if _engine is None:
                from rapidocr_onnxruntime import RapidOCR

                _engine = RapidOCR()
    return _engine


@dataclass
class OcrResult:
    text: str
    confidence: float  # mean line confidence, 0..1
    lines: int


def preprocess(image: Image.Image) -> np.ndarray:
    """Grayscale, invert dark slides (white text on black), upscale tiny images."""
    gray = np.array(image.convert("L"))
    if gray.mean() < 110:  # dark background slide
        gray = 255 - gray
    h, w = gray.shape
    if max(h, w) < 1200:
        scale = 1200 / max(h, w)
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def _reading_order(boxes: list) -> list:
    """Sort detected lines top to bottom, then left to right, grouping lines on the same row."""
    items = []
    for box, text, score in boxes:
        ys = [p[1] for p in box]
        xs = [p[0] for p in box]
        items.append((min(ys), max(ys), min(xs), text, float(score)))
    items.sort(key=lambda t: (t[0], t[2]))

    rows: list[list] = []
    for item in items:
        mid = (item[0] + item[1]) / 2
        if rows and abs(((rows[-1][0][0] + rows[-1][0][1]) / 2) - mid) < (item[1] - item[0]) * 0.6:
            rows[-1].append(item)
        else:
            rows.append([item])
    return [sorted(row, key=lambda t: t[2]) for row in rows]


GLUED_RUN = re.compile(r"[A-Za-z]{6,}")


def fix_spacing(line: str) -> str:
    """The recognition model sometimes drops spaces on big bold fonts ("Itdoesnotexplain").
    Only lines whose average word is suspiciously long get re-segmented."""
    words = line.split()
    if not words or sum(len(w) for w in words) / len(words) < 11:
        return line
    return GLUED_RUN.sub(lambda m: " ".join(wordninja.split(m.group(0))), line)


def ocr_image(image: Image.Image) -> OcrResult:
    ocr = engine()
    with _run_lock:
        result, _ = ocr(preprocess(image))
    if not result:
        return OcrResult(text="", confidence=0.0, lines=0)

    rows = _reading_order(result)
    text = "\n".join(fix_spacing(" ".join(t[3] for t in row)) for row in rows)
    scores = [t[4] for row in rows for t in row]
    return OcrResult(text=text.strip(), confidence=round(sum(scores) / len(scores), 3), lines=len(rows))
