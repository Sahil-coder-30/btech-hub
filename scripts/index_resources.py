"""
Indexes every resource that has a link into Pinecone, through the ML service.

The ML service (ml-service/, FastAPI) is the single ingestion pipeline: it downloads the file,
reads the text layer or OCRs scanned pages, chunks, embeds with Gemini, upserts to Pinecone
and records one row per file in the Supabase `documents` table (source_url = the resource link).
The app uses that table to know which material is indexed, and rejects questions about
subjects that are not indexed yet.

This script only decides what to send:
- Google Drive PDFs: the link goes to POST /v1/ingest.
- YouTube lectures: the caption transcript is fetched here and sent to POST /v1/index.

It is safe to re-run: files that are already indexed are skipped.

Setup (once):
    python3 -m venv scripts/.venv
    scripts/.venv/bin/pip install -r scripts/requirements.txt

Start the ML service first (see ml-service/README.md), then from the btech-hub folder:
    scripts/.venv/bin/python scripts/index_resources.py              # index everything new
    scripts/.venv/bin/python scripts/index_resources.py --dry-run    # only list what would be sent
    scripts/.venv/bin/python scripts/index_resources.py --only pdf   # or: --only video
    scripts/.venv/bin/python scripts/index_resources.py --limit 5    # try a few first
    scripts/.venv/bin/python scripts/index_resources.py --retry-failed
"""

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPE_LABEL = {"notes": "Notes", "pyq": "PYQ", "lecture": "Lecture", "imp_question": "Important questions", "other": "Resource"}


# ---------- config ----------

def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


ENV = load_env()


def need(key: str) -> str:
    value = ENV.get(key, "")
    if not value or value.startswith(("your-", "replace-", "generate-")):
        sys.exit(f"Missing {key} in .env.local")
    return value


SB_URL = need("SUPABASE_URL").rstrip("/") + "/rest/v1"
SB_HEADERS = {"apikey": need("SUPABASE_SECRET_KEY"), "Authorization": f"Bearer {need('SUPABASE_SECRET_KEY')}"}
ML_URL = need("ML_SERVICE_URL").rstrip("/")
ML_HEADERS = {"Authorization": f"Bearer {need('ML_SERVICE_TOKEN')}"}


# ---------- HTTP ----------

def http(method: str, url: str, headers: dict | None = None, data: bytes | None = None, timeout: int = 90, retries: int = 3):
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                raw = res.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as err:
            text = err.read().decode(errors="replace")
            try:
                text = json.loads(text).get("detail", text)
            except ValueError:
                pass
            if err.code >= 500 and err.code != 502 and attempt < retries - 1:
                time.sleep(10)
                continue
            raise RuntimeError(f"{err.code}: {str(text)[:200]}")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as err:
            if attempt == retries - 1:
                raise RuntimeError(f"network error: {err}")
            time.sleep(5)


def sb_get(path: str):
    return http("GET", f"{SB_URL}/{path}", SB_HEADERS)


def sb_insert(table: str, row: dict):
    http("POST", f"{SB_URL}/{table}", {**SB_HEADERS, "Content-Type": "application/json"}, json.dumps(row).encode())


def multipart(fields: dict) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    body = b""
    for name, value in fields.items():
        if value in (None, ""):
            continue
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    body += f"--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


# ---------- ML service ----------

def ml_ingest_link(fields: dict) -> dict:
    body, content_type = multipart(fields)
    # OCR runs at about 1 second per scanned page, so big PDFs need a long timeout
    return http("POST", f"{ML_URL}/v1/ingest", {**ML_HEADERS, "Content-Type": content_type}, body, timeout=1800, retries=1)


def ml_index_text(payload: dict) -> dict:
    return http("POST", f"{ML_URL}/v1/index", {**ML_HEADERS, "Content-Type": "application/json"}, json.dumps(payload).encode(), timeout=600, retries=1)


def ml_delete(document_id: str):
    http("DELETE", f"{ML_URL}/v1/index/{document_id}", ML_HEADERS)


# ---------- grouping ----------

def drive_id(url: str) -> str | None:
    match = re.search(r"/d/([\w-]+)", url) or re.search(r"[?&]id=([\w-]+)", url)
    return match.group(1) if match else None


def youtube_id(url: str) -> str | None:
    match = re.search(r"(?:youtu\.be/|/live/|/embed/|[?&]v=)([\w-]{11})", url)
    return match.group(1) if match else None


def group_resources(rows: list[dict]) -> dict:
    """One entry per unique file (many rows can share the same link)."""
    files: dict[str, dict] = {}
    for r in rows:
        url = r["url"]
        did = drive_id(url) if "drive.google" in url else None
        vid = youtube_id(url)
        if did:
            key, kind = f"drive:{did}", "pdf"
        elif vid:
            key, kind = f"yt:{vid}", "video"
        else:
            key, kind = f"other:{url}", "other"
        f = files.setdefault(key, {"key": key, "kind": kind, "url": url, "id": did or vid, "rows": []})
        f["rows"].append(r)
    return files


def describe(f: dict) -> dict:
    rows = f["rows"]
    first = rows[0]
    return {
        "title": f"{first['subject_title']} · {TYPE_LABEL.get(first['type'], 'Resource')} · {first['label']}"[:300],
        "codes": sorted({r["subject_code"] for r in rows if r.get("subject_code")}),
        "branches": sorted({r["branch_code"] for r in rows if r.get("branch_code")}),  # empty = all branches
        "years": sorted({r["year"] for r in rows}),
    }


def transcript_text(video_id: str) -> str:
    from youtube_transcript_api import YouTubeTranscriptApi

    snippets = YouTubeTranscriptApi().fetch(video_id, languages=["en", "en-IN", "hi"])
    return " ".join(s.text.replace("\n", " ") for s in snippets).strip()


# ---------- main ----------

def index_file(f: dict, dry: bool) -> tuple[str, str]:
    info = describe(f)
    if f["kind"] == "other":
        return "skipped", "unsupported link type"
    if dry:
        return "dry", f"would send {f['kind']} to {'/v1/ingest' if f['kind'] == 'pdf' else '/v1/index'}"

    if f["kind"] == "pdf":
        result = ml_ingest_link({
            "title": info["title"],
            "url": f["url"],
            "subject_codes": ",".join(info["codes"]),
            "branch_codes": ",".join(info["branches"]),
            "years": ",".join(str(y) for y in info["years"]),
            "kind": "pdf",
        })
        methods = result.get("methods", {})
        how = "OCR" if methods.get("ocr") else "text layer"
        return "indexed", f"{result['chunks']} chunks, {result.get('page_count', '?')} pages via {how}"

    text = transcript_text(f["id"])
    if len(text) < 80:
        return "failed", "captions are empty"
    result = ml_index_text({
        "text": text,
        "title": info["title"],
        "source_url": f["url"],
        "subject_codes": info["codes"],
        "branch_codes": info["branches"],
        "years": info["years"],
        "kind": "video",
    })
    return "indexed", f"{result['chunks']} chunks from captions"


def main():
    parser = argparse.ArgumentParser(description="Index linked resources into Pinecone through the ML service")
    parser.add_argument("--dry-run", action="store_true", help="only list what would be sent")
    parser.add_argument("--only", choices=["pdf", "video"], help="index only PDFs or only YouTube lectures")
    parser.add_argument("--limit", type=int, help="stop after N files")
    parser.add_argument("--retry-failed", action="store_true", help="try files that failed before")
    args = parser.parse_args()

    if not args.dry_run:
        try:
            health = http("GET", f"{ML_URL}/health", timeout=10, retries=1)
        except RuntimeError as err:
            sys.exit(f"ML service is not reachable at {ML_URL} ({err}). Start it first: see ml-service/README.md")
        if not health.get("indexing"):
            sys.exit("ML service is running but indexing is not configured (check ml-service/.env).")

    rows = sb_get("resources?select=*&url=not.is.null&order=id&limit=10000")
    files = group_resources(rows)
    existing = {d["source_url"]: d for d in sb_get("documents?select=id,source_url,status&source_url=not.is.null&limit=10000")}

    todo = []
    for f in files.values():
        if args.only and f["kind"] != args.only:
            continue
        prior = existing.get(f["url"])
        if prior and prior["status"] == "indexed":
            continue
        if prior and prior["status"] in ("failed", "pending") and not args.retry_failed:
            continue
        todo.append((f, prior))
    if args.limit:
        todo = todo[: args.limit]

    already = sum(1 for d in existing.values() if d["status"] == "indexed")
    print(f"{len(rows)} resource rows with links -> {len(files)} unique files. Already indexed: {already}. To do now: {len(todo)}\n")

    totals = {"indexed": 0, "failed": 0, "skipped": 0, "dry": 0}
    for n, (f, prior) in enumerate(todo, 1):
        label = f"[{n}/{len(todo)}] {f['kind']:5} {describe(f)['title'][:70]}"
        try:
            if prior and not args.dry_run:  # failed before: clear the old row and any partial vectors
                ml_delete(prior["id"])
            status, detail = index_file(f, args.dry_run)
        except Exception as err:
            reason = str(err).strip().splitlines()[0] if str(err).strip() else ""
            status, detail = "failed", (f"{type(err).__name__}: {reason}" if reason else type(err).__name__)[:160]
        if status == "failed" and not args.dry_run:
            # keep a record so broken links are not retried on every run
            found = sb_get(f"documents?select=id&source_url=eq.{urllib.parse.quote(f['url'], safe='')}")
            if not found:
                sb_insert("documents", {"title": describe(f)["title"], "source_url": f["url"], "status": "failed", "error": detail})
        totals[status] += 1
        print(f"{label} -> {status}: {detail}", flush=True)

    print("\nDone.", totals)
    if totals["failed"]:
        print("Failed files are saved with status 'failed' (see /admin). Fix the link and run with --retry-failed.")


if __name__ == "__main__":
    main()
