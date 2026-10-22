# B.Tech Hub ML Service

FastAPI service for **vision + OCR + indexing**. It is deployed separately from the Next.js app and is called only by our own servers (shared bearer token).

## What it does

| Step | How |
|---|---|
| Digital PDFs | Text layer read with `pypdfium2` (fast, exact) |
| Scanned PDFs and photos | Page rendered to an image, then **local OCR** with RapidOCR (PaddleOCR models on ONNX Runtime, CPU, no API cost) |
| Dark slides | Auto inverted before OCR |
| Glued words | `wordninja` re-segments lines like `Itdoesnotexplain` |
| Handwriting / very noisy pages | Optional Gemini vision fallback when OCR confidence is low (`vision=true`) |
| Photo quality | Blur (Laplacian variance), brightness, contrast, resolution, with tips to retake |
| Understanding | Language (English / Hindi / mixed), AKTU subject codes, keywords, notes vs PYQ guess |
| Indexing | Chunk, Mistral `mistral-embed` embeddings (1024 dims, Gemini optional), Pinecone upsert, `documents` row in Supabase |

Speed on a laptop CPU: about **1 second per scanned page**.

## API

All `/v1` routes need `Authorization: Bearer <ML_SERVICE_TOKEN>`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | | `{ ok, indexing, vision_fallback }` |
| POST | `/v1/extract` | multipart `file`, optional `vision=true` | text, per page method and confidence, quality, analysis |
| POST | `/v1/analyze-image` | multipart `file` | quality issues, OCR confidence, preview |
| POST | `/v1/index` | JSON `{ text, title, source_url?, subject_codes?, branch_codes?, years?, kind?, uploaded_by? }` | `{ document_id, chunks }` |
| POST | `/v1/ingest` | multipart `title` + `file` **or** `url` (Drive links work), optional `subject_codes`, `branch_codes`, `years` (comma separated), `kind`, `uploaded_by`, `vision` | the full pipeline in one call |
| DELETE | `/v1/index/{document_id}` | optional `?chunks=N` | removes vectors and the documents row |

Interactive docs: `http://localhost:8000/docs`.

## Run locally

```bash
cd ml-service
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # fill the values, same keys as the Next.js app
.venv/bin/uvicorn app.main:app --port 8000
```

Generate the shared token with `openssl rand -hex 32` and put the **same value** in:

- `ml-service/.env` as `ML_SERVICE_TOKEN`
- `btech-hub/.env.local` as `ML_SERVICE_TOKEN` (plus `ML_SERVICE_URL=http://localhost:8000`)

## Deploy

```bash
docker build -t btechhub-ml .
docker run -p 8000:8000 --env-file .env btechhub-ml
```

Works on Render, Railway, Fly.io or Google Cloud Run (the container reads `PORT`). Give it at least **1 GB RAM**. After deploying, set `ML_SERVICE_URL` in the Next.js app to the public URL.

## How the app uses it

1. A student uploads a PDF or photo on `/upload`.
2. Next.js checks login, then sends the file to `/v1/extract`.
3. The text, quality checks and analysis are saved in `user_uploads` with status `pending`.
4. An admin reviews it on `/admin/uploads`. Approve calls `/v1/index`, so it becomes searchable in Vac and Ask your Syllabus.

Every other way material gets indexed also goes through this service, so PDFs are broken down in one place only:

| Source | Endpoint |
|---|---|
| Admin panel, PDF upload or link | `/v1/ingest` |
| Admin panel, "index syllabus" button | `/v1/ingest` with the Drive link |
| `scripts/index_resources.py` | `/v1/ingest` for PDFs, `/v1/index` for YouTube captions |
| Student uploads | `/v1/extract` on upload, `/v1/index` on approval |

## Limits

- Embeddings use Mistral by default (`EMBEDDING_PROVIDER=mistral`): 60 requests per minute, no daily cap seen on the free plan. Batches are sized by text length because Mistral limits tokens per request.
- With `EMBEDDING_PROVIDER=gemini` the free tier allows only 1000 chunks per day; the service then fails fast with a clear message.
- Switching provider means re-embedding: set the new `PINECONE_NAMESPACE`, then run `.venv/bin/python -m app.reembed --from <old-namespace>` (reuses chunk text from Pinecone, no re-OCR). The Next.js app must use the same `EMBEDDING_PROVIDER` and namespace.
