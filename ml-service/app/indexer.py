"""Chunk, embed with Gemini, store vectors in Pinecone and record the document in Supabase."""

import logging
import re
import time
import uuid

import httpx

from .config import get_settings

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150
EMBED_BATCH = 20  # small batches stay under the free tier tokens-per-minute limit
PAGE_CHUNK_SIZE = 1000
MIN_CHUNK = 150
PAGE_BATCH = 50

log = logging.getLogger(__name__)


class IndexError_(RuntimeError):
    pass


def split_text(text: str) -> list[str]:
    """Paragraph aware splitter. Very long runs are cut at word boundaries."""
    pieces = []
    for para in re.split(r"\n{2,}", text):
        para = para.strip()
        if not para:
            continue
        if len(para) <= CHUNK_SIZE:
            pieces.append(para)
            continue
        start = 0
        while start < len(para):
            end = min(start + CHUNK_SIZE - CHUNK_OVERLAP, len(para))
            if end < len(para):
                space = para.rfind(" ", start + 200, end)
                end = space if space > 0 else end
            pieces.append(para[start:end].strip())
            start = end

    chunks, current = [], ""
    for piece in pieces:
        if current and len(current) + len(piece) + 1 > CHUNK_SIZE:
            chunks.append(current)
            current = current[-CHUNK_OVERLAP:]
        current = f"{current} {piece}".strip()
    if current:
        chunks.append(current)
    return chunks


SUBJECT_CODE = re.compile(r"\b[BK][A-Z]{2,3}\d{3}[A-Z]?\b")
# A heading line starts with the code, e.g. "BCS301 DATA STRUCTURE", "BCS351- Data Structure Lab", "Subject Code: BAS101"
HEADING = re.compile(r"^(?i:(?:subject|course|paper)\s*code\s*[:\-–]?\s*)?([BK][A-Z]{2,3}\d{3}[A-Z]?)\b[\s\-–:.)|]*(.*)$")
UNIT_LINE = re.compile(r"^(?:unit[\s\-–:]*)?(?:[IVX]{1,4}|[1-9])\.?$", re.I)
SMALL_WORDS = {"a", "an", "and", "of", "the", "for", "in", "on", "to", "with", "or", "&"}
DENSE_PAGE_CODES = 6  # more distinct codes than this on one page = evaluation scheme or course list


def _clean_page(text: str) -> str:
    """Normalises PDF page text: line endings, soft hyphens (U+FFFE from pdfium), NUL bytes, trailing spaces."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\ufffe", "-").replace("\x00", "")
    return "\n".join(line.rstrip() for line in text.split("\n")).strip()


def _title_case(title: str) -> str:
    """ALL CAPS titles become Title Case. Acronyms without vowels (DBMS, HTML) and 2 letter ones (AI, ML) stay."""
    if not title.isupper():
        return title
    words = []
    for i, word in enumerate(title.split()):
        low = word.lower()
        if i and low in SMALL_WORDS:
            words.append(low)
        elif (len(word) == 2 and word.isalpha()) or not re.search(r"[AEIOU]", word):
            words.append(word)
        else:
            words.append(word.capitalize())
    return " ".join(words)


def _title_like(text: str) -> bool:
    letters = sum(c.isalpha() for c in text)
    return 3 <= letters and len(text) <= 90 and not SUBJECT_CODE.search(text) and len(re.findall(r"\b\d+\b", text)) < 3


def _heading(lines: list[str], i: int) -> str | None:
    """Returns "CODE Title" when line i looks like a subject heading."""
    match = HEADING.match(lines[i].strip())
    if not match:
        return None
    code, title = match.group(1), re.sub(r"\s+\d-\d-\d$", "", match.group(2)).strip(" -–:|")
    if not title:
        # code alone on its line, title on the next one
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        title = nxt if nxt[:1].isalpha() else ""
    title = re.sub(r"\s+", " ", title)
    return f"{code} {_title_case(title)}" if _title_like(title) else None


def _page_headings(lines: list[str]) -> dict[int, str]:
    """
    Subject headings on one page, by line index. Skipped:
    - candidates within 2 lines of another candidate: course lists such as elective tables
    - on pages with many distinct codes (evaluation scheme), any candidate followed by more codes on the page
    """
    found = {i: h for i in range(len(lines)) if (h := _heading(lines, i))}
    found = {i: h for i, h in found.items() if not any(j != i and abs(j - i) <= 2 for j in found)}
    if len(set(SUBJECT_CODE.findall("\n".join(lines)))) > DENSE_PAGE_CODES:
        for i in list(found):
            rest = "\n".join(lines[i + 1 :])
            if SUBJECT_CODE.search(rest) or len(rest) < 200:
                del found[i]
    return found


def _split_long(line: str, size: int) -> list[str]:
    """Cuts a line longer than size at word boundaries."""
    parts = []
    while len(line) > size:
        cut = line.rfind(" ", size // 2, size)
        cut = cut if cut > 0 else size
        parts.append(line[:cut].strip())
        line = line[cut:].strip()
    return parts + [line] if line else parts


def split_pages(pages: list[dict], size: int = PAGE_CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    """
    Page aware splitter. Returns [{text, page, pageEnd, section}].
    A chunk never mixes two subject sections and spans at most 2 pages. It is cut at a line
    (or word) boundary, preferably right before a unit marker or blank line. Hard cuts carry about
    `overlap` chars of the previous chunk; cuts at a section, unit or paragraph start do not.
    """
    units: list[tuple[int, str, str, bool]] = []  # (page, section, line, soft break before it)
    section = ""
    for p in sorted(pages, key=lambda p: p["page"]):
        lines = _clean_page(p.get("text") or "").split("\n")
        headings = _page_headings(lines)
        blank = False
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                blank = True
                continue
            if i in headings:
                section = headings[i]
            soft = blank or bool(UNIT_LINE.match(line))
            for j, part in enumerate(_split_long(line, size - overlap)):
                units.append((int(p["page"]), section, part, soft and j == 0))
            blank = False

    raw: list[dict] = []  # {lines: [(page, line)], section, overlap: lines carried from the previous chunk}
    current: list[tuple[int, str]] = []
    current_section, carried = "", 0
    for page, sec, line, soft in units:
        length = sum(len(x) + 1 for _, x in current)
        too_big = length + len(line) > size
        if too_big and len(current) == carried:
            current, carried, length, too_big = [], 0, 0, False  # the overlap alone would be a chunk, drop it
        if current and (sec != current_section or page > current[0][0] + 1 or too_big or (soft and length >= size * 0.6)):
            raw.append({"lines": current, "section": current_section, "overlap": carried})
            tail: list[tuple[int, str]] = []
            if sec == current_section and too_big and not soft:
                room = overlap
                for pg, x in reversed(current):
                    if len(x) + 1 <= room:
                        tail.insert(0, (pg, x))
                        room -= len(x) + 1
                        continue
                    cut = x.find(" ", len(x) - room)
                    if cut > 0:
                        tail.insert(0, (pg, x[cut + 1 :]))
                    break
            current = [(pg, x) for pg, x in tail if pg >= page - 1]
            carried = len(current)
        current_section = sec
        current.append((page, line))
    if current:
        raw.append({"lines": current, "section": current_section, "overlap": carried})

    # Tiny leftovers (a stray title line, a closing "08") join a neighbour when the 2 page rule allows
    merged: list[dict] = []
    for i, c in enumerate(raw):
        own = c["lines"][c["overlap"] :]
        if sum(len(x) + 1 for _, x in own) < MIN_CHUNK:
            prev, nxt = merged[-1] if merged else None, raw[i + 1] if i + 1 < len(raw) else None
            if prev and prev["section"] == c["section"] and own and own[-1][0] - prev["lines"][0][0] <= 1:
                prev["lines"] = prev["lines"] + own
                continue
            if nxt and nxt["lines"][-1][0] - c["lines"][0][0] <= 1:
                # nxt's overlap is a copy of c's last lines, so c replaces it
                nxt["lines"] = c["lines"] + nxt["lines"][nxt["overlap"] :]
                nxt["overlap"] = c["overlap"]
                continue
        merged.append(c)

    chunks = []
    for c in merged:
        body = "\n".join(x for _, x in c["lines"]).strip()
        if body:
            text = f"[{c['section']}]\n{body}" if c["section"] else body
            chunks.append({"text": text, "page": c["lines"][0][0], "pageEnd": c["lines"][-1][0], "section": c["section"]})
    return chunks


def _request(method: str, url: str, retries: int = 8, **kwargs) -> httpx.Response:
    for attempt in range(retries):
        res = httpx.request(method, url, timeout=120, **kwargs)
        if res.status_code == 429 and "PerDay" in res.text:
            raise IndexError_("Gemini daily embedding quota is used up (free tier: 1000 per day). Try again tomorrow or enable billing.")
        if res.status_code == 429 or res.status_code >= 500:
            # Gemini says how long to wait ("retry in 17.4s" or retryDelay "17s"); per-minute windows need ~60s
            match = re.search(r"retry in ([\d.]+)s", res.text) or re.search(r'"retryDelay":\s*"(\d+)s"', res.text)
            retry_after = res.headers.get("retry-after")
            if match:
                wait = float(match.group(1)) + 3
            elif retry_after and retry_after.replace(".", "", 1).isdigit():
                wait = float(retry_after) + 1
            else:
                wait = 20 * (attempt + 1)
            time.sleep(min(90, wait))
            continue
        if res.is_error:
            raise IndexError_(f"{method} {url.split('?')[0]} -> {res.status_code}: {res.text[:300]}")
        return res
    raise IndexError_(f"{method} {url.split('?')[0]} kept failing (rate limited)")


MISTRAL_BATCH = 64
MISTRAL_BATCH_CHARS = 24_000  # Mistral caps tokens per request; OCR text is token heavy, so budget by size


def embed(texts: list[str]) -> list[list[float]]:
    """Embeds chunks with the configured provider. Both return 1024 dims for the Pinecone index."""
    return _embed_mistral(texts) if get_settings().embedding_provider == "mistral" else _embed_gemini(texts)


def _mistral_call(batch: list[str]) -> list[list[float]]:
    s = get_settings()
    try:
        res = _request(
            "POST",
            "https://api.mistral.ai/v1/embeddings",
            headers={"Authorization": f"Bearer {s.mistral_api_key}"},
            json={"model": s.mistral_embedding_model, "input": batch},
        )
    except IndexError_ as err:
        # Still too many tokens for one request: split in half and try again
        if "Too many tokens" in str(err) and len(batch) > 1:
            half = len(batch) // 2
            return _mistral_call(batch[:half]) + _mistral_call(batch[half:])
        raise
    return [item["embedding"] for item in sorted(res.json()["data"], key=lambda d: d["index"])]


def _embed_mistral(texts: list[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    batch: list[str] = []
    size = 0
    for text in texts:
        if batch and (len(batch) >= MISTRAL_BATCH or size + len(text) > MISTRAL_BATCH_CHARS):
            vectors.extend(_mistral_call(batch))
            batch, size = [], 0
        batch.append(text)
        size += len(text)
    if batch:
        vectors.extend(_mistral_call(batch))
    return vectors


def _embed_gemini(texts: list[str]) -> list[list[float]]:
    s = get_settings()
    vectors: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH):
        batch = texts[i : i + EMBED_BATCH]
        res = _request(
            "POST",
            f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_embedding_model}:batchEmbedContents",
            headers={"x-goog-api-key": s.gemini_api_key},
            json={
                "requests": [
                    {
                        "model": f"models/{s.gemini_embedding_model}",
                        "content": {"parts": [{"text": t}]},
                        "taskType": "RETRIEVAL_DOCUMENT",
                        "outputDimensionality": s.embedding_dimensions,
                    }
                    for t in batch
                ]
            },
        )
        vectors.extend(e["values"] for e in res.json()["embeddings"])
    return vectors


_pinecone_host: str | None = None


def _pinecone() -> tuple[str, dict]:
    global _pinecone_host
    s = get_settings()
    headers = {"Api-Key": s.pinecone_api_key, "X-Pinecone-API-Version": "2025-04"}
    if not _pinecone_host:
        _pinecone_host = _request("GET", f"https://api.pinecone.io/indexes/{s.pinecone_index}", headers=headers).json()["host"]
    return _pinecone_host, headers


def _supabase() -> tuple[str, dict]:
    s = get_settings()
    return f"{s.supabase_url.rstrip('/')}/rest/v1", {"apikey": s.supabase_secret_key, "Authorization": f"Bearer {s.supabase_secret_key}"}


def configured() -> bool:
    s = get_settings()
    embed_key = s.mistral_api_key if s.embedding_provider == "mistral" else s.gemini_api_key
    return all([embed_key, s.pinecone_api_key, s.supabase_url, s.supabase_secret_key])


def index_text(
    text: str,
    title: str,
    source_url: str | None = None,
    subject_codes: list[str] | None = None,
    branch_codes: list[str] | None = None,
    years: list[int] | None = None,
    kind: str = "upload",
    uploaded_by: str | None = None,
    pages: list[dict] | None = None,
) -> dict:
    """
    Indexes text and returns {document_id, chunks}. The documents row tracks what is indexed.
    With pages ([{page, text}] from extract) chunks keep their page numbers and subject section,
    and the page texts are stored in document_pages for keyword search.
    """
    if not configured():
        raise IndexError_("Indexing is not configured. Set the embedding key (MISTRAL_API_KEY or GEMINI_API_KEY), PINECONE_API_KEY, SUPABASE_URL and SUPABASE_SECRET_KEY.")
    page_chunks = split_pages(pages) if pages else None
    chunks = [c["text"] for c in page_chunks] if page_chunks is not None else split_text(text)
    if not chunks:
        raise IndexError_("No text to index.")

    sb_url, sb_headers = _supabase()
    subject_codes = subject_codes or []
    branch_codes = branch_codes or [""]
    years = years or [0]
    doc_id = str(uuid.uuid4())
    row = {
        "id": doc_id,
        "title": title[:300],
        "source_url": source_url,
        "subject_code": subject_codes[0] if subject_codes else None,
        "branch_code": branch_codes[0] if len(branch_codes) == 1 and branch_codes[0] else None,
        "year": years[0] if len(years) == 1 and years[0] else None,
        "uploaded_by": uploaded_by,
        "status": "pending",
    }
    extra = {"kind": kind, **({"page_count": len(pages)} if pages else {})}
    try:
        _request("POST", f"{sb_url}/documents", headers=sb_headers, json={**row, **extra})
    except IndexError_ as err:
        # kind / page_count come from the ask_syllabus migration; older databases reject unknown columns
        if "PGRST204" not in str(err) and "column" not in str(err):
            raise
        _request("POST", f"{sb_url}/documents", headers=sb_headers, json=row)

    try:
        vectors = embed(chunks)
        host, pc_headers = _pinecone()
        s = get_settings()
        records = [
            {
                "id": f"{doc_id}#{i}",
                "values": vectors[i],
                "metadata": {
                    "docId": doc_id,
                    "title": title[:300],
                    "sourceUrl": source_url or "",
                    "subjectCode": subject_codes or [""],
                    "branchCode": branch_codes,
                    # Pinecone lists must be strings, so year is one number (0 = any year)
                    "year": years[0] if len(years) == 1 else 0,
                    "kind": kind,
                    "chunk": i,
                    "text": chunks[i],
                    **(
                        {"page": page_chunks[i]["page"], "pageEnd": page_chunks[i]["pageEnd"], "section": page_chunks[i]["section"]}
                        if page_chunks
                        else {}
                    ),
                },
            }
            for i in range(len(chunks))
        ]
        for i in range(0, len(records), 100):
            _request("POST", f"https://{host}/vectors/upsert", headers=pc_headers, json={"vectors": records[i : i + 100], "namespace": s.pinecone_namespace})
        if pages:
            _store_pages(sb_url, sb_headers, doc_id, pages)
        _request("PATCH", f"{sb_url}/documents?id=eq.{doc_id}", headers=sb_headers, json={"status": "indexed", "chunk_count": len(chunks)})
    except Exception as err:
        _request("PATCH", f"{sb_url}/documents?id=eq.{doc_id}", headers=sb_headers, json={"status": "failed", "error": str(err)[:500]})
        raise

    return {"document_id": doc_id, "chunks": len(chunks)}


def _store_pages(sb_url: str, sb_headers: dict, doc_id: str, pages: list[dict]) -> None:
    """Page texts for keyword search. Optional: a missing table only logs a warning."""
    rows = [{"document_id": doc_id, "page": int(p["page"]), "text": t} for p in pages if (t := _clean_page(p.get("text") or ""))]
    try:
        for i in range(0, len(rows), PAGE_BATCH):
            _request("POST", f"{sb_url}/document_pages", retries=3, headers=sb_headers, json=rows[i : i + PAGE_BATCH])
    except Exception as err:
        log.warning("document_pages insert failed for %s, keyword search will miss it: %s", doc_id, err)


def delete_document(document_id: str, chunk_count: int | None = None) -> None:
    host, pc_headers = _pinecone()
    s = get_settings()
    sb_url, sb_headers = _supabase()
    if chunk_count is None:
        rows = _request("GET", f"{sb_url}/documents?select=chunk_count&id=eq.{document_id}", headers=sb_headers).json()
        # failed rows may have partial vectors without a count, so clear a safe range
        chunk_count = (rows[0]["chunk_count"] if rows else 0) or 400
    ids = [f"{document_id}#{i}" for i in range(chunk_count)]
    for i in range(0, len(ids), 1000):
        _request("POST", f"https://{host}/vectors/delete", headers=pc_headers, json={"ids": ids[i : i + 1000], "namespace": s.pinecone_namespace})
    _request("DELETE", f"{sb_url}/documents?id=eq.{document_id}", headers=sb_headers)
