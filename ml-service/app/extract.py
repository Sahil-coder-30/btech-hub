"""Turns an uploaded PDF or image into clean text, page by page."""

import io
from dataclasses import asdict, dataclass

import pypdfium2 as pdfium
from PIL import Image, ImageOps

from .config import get_settings
from .ocr import ocr_image
from .vision import analyse_text, gemini_vision_ocr, image_quality

PDF_MAGIC = b"%PDF-"


class ExtractError(ValueError):
    pass


@dataclass
class PageText:
    page: int
    text: str
    method: str  # text_layer | ocr | vision
    confidence: float


def _ocr_with_fallback(image: Image.Image, page: int, allow_vision: bool) -> PageText:
    settings = get_settings()
    result = ocr_image(image)
    if allow_vision and (result.lines == 0 or result.confidence < settings.vision_fallback_confidence):
        vision_text = gemini_vision_ocr(image)
        if vision_text:
            return PageText(page, vision_text, "vision", 0.9)
    return PageText(page, result.text, "ocr", result.confidence)


def extract_pdf(data: bytes, allow_vision: bool = False) -> list[PageText]:
    settings = get_settings()
    try:
        pdf = pdfium.PdfDocument(data)
    except Exception as err:
        raise ExtractError(f"Could not open PDF: {err}") from err

    if len(pdf) > settings.max_pages:
        raise ExtractError(f"PDF has {len(pdf)} pages. The limit is {settings.max_pages}.")

    pages: list[PageText] = []
    for i in range(len(pdf)):
        page = pdf[i]
        text = page.get_textpage().get_text_range().strip()
        if len(text) >= settings.min_text_chars_per_page:
            pages.append(PageText(i + 1, text, "text_layer", 1.0))
        else:
            image = page.render(scale=settings.render_scale).to_pil()
            pages.append(_ocr_with_fallback(image, i + 1, allow_vision))
        page.close()
    pdf.close()
    return pages


def extract_image(data: bytes, allow_vision: bool = False) -> tuple[list[PageText], dict]:
    try:
        image = Image.open(io.BytesIO(data))
        image = ImageOps.exif_transpose(image)  # phone photos carry rotation in EXIF
    except Exception as err:
        raise ExtractError(f"Could not open image: {err}") from err
    quality = image_quality(image)
    return [_ocr_with_fallback(image, 1, allow_vision)], quality


def extract(data: bytes, filename: str, allow_vision: bool = False) -> dict:
    settings = get_settings()
    if len(data) > settings.max_file_mb * 1024 * 1024:
        raise ExtractError(f"File is larger than {settings.max_file_mb} MB.")

    quality = None
    if data[:5] == PDF_MAGIC:
        kind = "pdf"
        pages = extract_pdf(data, allow_vision)
    else:
        kind = "image"
        pages, quality = extract_image(data, allow_vision)

    text = "\n\n".join(p.text for p in pages if p.text).strip()
    methods = {m: sum(1 for p in pages if p.method == m) for m in ("text_layer", "ocr", "vision")}
    ocr_pages = [p.confidence for p in pages if p.method == "ocr"]

    return {
        "filename": filename,
        "kind": kind,
        "page_count": len(pages),
        "methods": methods,
        "ocr_confidence": round(sum(ocr_pages) / len(ocr_pages), 3) if ocr_pages else None,
        "quality": quality,
        "analysis": analyse_text(text),
        "text": text,
        "pages": [asdict(p) for p in pages],
    }
