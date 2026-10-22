"""
B.Tech Hub ML service: vision + OCR + indexing over HTTP.

Deployed separately from the Next.js app. Every /v1 route needs
"Authorization: Bearer <ML_SERVICE_TOKEN>", so only our own servers can call it.
"""

import hmac
import time

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from . import indexer
from .config import get_settings
from .extract import ExtractError, extract
from .fetch import FetchError, download
from .ocr import engine

app = FastAPI(title="B.Tech Hub ML Service", version="1.0.0", description="Vision, OCR and indexing for study material uploads.")


def require_token(authorization: str = Header(default="")) -> None:
    expected = get_settings().ml_service_token
    if not expected:
        raise HTTPException(503, "ML_SERVICE_TOKEN is not set on the service.")
    token = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(token, expected):
        raise HTTPException(401, "Invalid service token.")


@app.on_event("startup")
def warm_up() -> None:
    # Load OCR models at boot so the first request is not slow
    engine()


@app.get("/health")
def health() -> dict:
    s = get_settings()
    return {
        "ok": True,
        "indexing": indexer.configured(),
        "embedding_provider": s.embedding_provider,
        "namespace": s.pinecone_namespace,
        "vision_fallback": bool(s.gemini_api_key),
    }


async def _read(file: UploadFile) -> bytes:
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file.")
    return data


@app.post("/v1/extract", dependencies=[Depends(require_token)])
async def extract_route(file: UploadFile = File(...), vision: bool = Form(False)) -> dict:
    """PDF or image in, text out. Pages without a text layer are OCR'd. vision=true enables the Gemini fallback."""
    data = await _read(file)
    started = time.perf_counter()
    try:
        result = await run_in_threadpool(extract, data, file.filename or "upload", vision)
    except ExtractError as err:
        raise HTTPException(422, str(err)) from err
    result["seconds"] = round(time.perf_counter() - started, 2)
    return result


@app.post("/v1/analyze-image", dependencies=[Depends(require_token)])
async def analyze_image(file: UploadFile = File(...)) -> dict:
    """Quick check for a photo before upload: quality issues plus an OCR preview."""
    data = await _read(file)
    try:
        result = await run_in_threadpool(extract, data, file.filename or "photo", False)
    except ExtractError as err:
        raise HTTPException(422, str(err)) from err
    return {
        "quality": result["quality"],
        "ocr_confidence": result["ocr_confidence"],
        "analysis": result["analysis"],
        "preview": result["text"][:800],
    }


class IndexRequest(BaseModel):
    text: str = Field(min_length=80)
    title: str = Field(min_length=2, max_length=300)
    source_url: str | None = None
    subject_codes: list[str] = []
    branch_codes: list[str] = []
    years: list[int] = []
    kind: str = "upload"
    uploaded_by: str | None = None


@app.post("/v1/index", dependencies=[Depends(require_token)])
async def index_route(body: IndexRequest) -> dict:
    """Chunks, embeds and stores already extracted text. Records the document in Supabase."""
    try:
        return await run_in_threadpool(
            indexer.index_text,
            body.text,
            body.title,
            body.source_url,
            body.subject_codes,
            body.branch_codes or [""],
            body.years or [0],
            body.kind,
            body.uploaded_by,
        )
    except indexer.IndexError_ as err:
        raise HTTPException(502, str(err)) from err


def _csv(value: str | None) -> list[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


@app.post("/v1/ingest", dependencies=[Depends(require_token)])
async def ingest_route(
    title: str = Form(...),
    file: UploadFile | None = File(None),
    url: str | None = Form(None),
    source_url: str | None = Form(None),
    subject_codes: str | None = Form(None, description="Comma separated, e.g. BAS101,BAS201"),
    branch_codes: str | None = Form(None, description="Comma separated. Empty means all branches"),
    years: str | None = Form(None, description="Comma separated years 1-4. Empty means any year"),
    kind: str = Form("pdf"),
    uploaded_by: str | None = Form(None),
    vision: bool = Form(False),
) -> dict:
    """
    The single pipeline for study material: file or public link in,
    text extraction (text layer or OCR), chunking, embeddings, Pinecone and a documents row out.
    """
    if file is not None:
        data, name = await _read(file), file.filename or "upload"
    elif url:
        try:
            data, name = await run_in_threadpool(download, url)
        except FetchError as err:
            raise HTTPException(422, str(err)) from err
    else:
        raise HTTPException(400, "Send a file or a url.")

    try:
        result = await run_in_threadpool(extract, data, name, vision)
    except ExtractError as err:
        raise HTTPException(422, str(err)) from err
    if len(result["text"]) < 80:
        raise HTTPException(422, "No readable text found in this file, even after OCR.")

    codes = _csv(subject_codes) or result["analysis"]["subject_codes"][:1]
    try:
        indexed = await run_in_threadpool(
            indexer.index_text,
            result["text"],
            title,
            source_url or url,
            codes,
            _csv(branch_codes) or [""],
            [int(y) for y in _csv(years) if y.isdigit()] or [0],
            kind,
            uploaded_by,
            pages=result["pages"],
        )
    except indexer.IndexError_ as err:
        raise HTTPException(502, str(err)) from err
    return {
        **indexed,
        "page_count": result["page_count"],
        "methods": result["methods"],
        "ocr_confidence": result["ocr_confidence"],
        "analysis": result["analysis"],
    }


@app.delete("/v1/index/{document_id}", dependencies=[Depends(require_token)])
async def delete_route(document_id: str, chunks: int | None = None) -> dict:
    """Removes a document's vectors and its documents row. Chunk count is looked up when not given."""
    try:
        await run_in_threadpool(indexer.delete_document, document_id, chunks)
    except indexer.IndexError_ as err:
        raise HTTPException(502, str(err)) from err
    return {"ok": True}
