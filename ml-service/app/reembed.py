"""
Moves already indexed documents to the current embedding provider without re-downloading or re-OCRing.
Chunk text is read from the Pinecone metadata of the old namespace, embedded again, and written
to the current namespace (PINECONE_NAMESPACE) with the same ids and metadata.

Usage (from ml-service/):
    .venv/bin/python -m app.reembed --from study-material
    .venv/bin/python -m app.reembed --from study-material --dry-run
"""

import argparse
from urllib.parse import urlencode

from .config import get_settings
from .indexer import _pinecone, _request, _supabase, embed


def fetch_chunks(host: str, headers: dict, namespace: str, doc_id: str, count: int) -> list[dict]:
    """Returns the stored vectors (with metadata) of one document from the given namespace."""
    found = []
    ids = [f"{doc_id}#{i}" for i in range(count)]
    for i in range(0, len(ids), 100):
        query = urlencode([("ids", x) for x in ids[i : i + 100]] + [("namespace", namespace)])
        res = _request("GET", f"https://{host}/vectors/fetch?{query}", headers=headers).json()
        found.extend(res.get("vectors", {}).values())
    return sorted(found, key=lambda v: v["metadata"].get("chunk", 0))


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-embed indexed documents with the current provider")
    parser.add_argument("--from", dest="source", required=True, help="old Pinecone namespace, e.g. study-material")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    s = get_settings()
    if args.source == s.pinecone_namespace:
        raise SystemExit("Source and target namespace are the same. Set PINECONE_NAMESPACE to the new namespace first.")

    sb_url, sb_headers = _supabase()
    docs = _request("GET", f"{sb_url}/documents?select=id,title,chunk_count&status=eq.indexed&limit=10000", headers=sb_headers).json()
    host, pc_headers = _pinecone()
    print(f"{len(docs)} indexed documents: {args.source} -> {s.pinecone_namespace} using {s.embedding_provider}\n")

    moved = missing = chunks_total = 0
    for n, doc in enumerate(docs, 1):
        chunks = fetch_chunks(host, pc_headers, args.source, doc["id"], doc["chunk_count"] or 0)
        if not chunks:
            missing += 1
            print(f"[{n}/{len(docs)}] {doc['title'][:70]} -> no vectors in {args.source}, re-index it with the script")
            continue
        if not args.dry_run:
            vectors = embed([c["metadata"]["text"] for c in chunks])
            records = [{"id": c["id"], "values": v, "metadata": c["metadata"]} for c, v in zip(chunks, vectors)]
            for i in range(0, len(records), 100):
                _request("POST", f"https://{host}/vectors/upsert", headers=pc_headers, json={"vectors": records[i : i + 100], "namespace": s.pinecone_namespace})
        moved += 1
        chunks_total += len(chunks)
        print(f"[{n}/{len(docs)}] {doc['title'][:70]} -> {len(chunks)} chunks")

    print(f"\nDone. moved={moved} chunks={chunks_total} missing={missing}{' (dry run)' if args.dry_run else ''}")


if __name__ == "__main__":
    main()
