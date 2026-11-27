// Copies every chunk from one Pinecone namespace to another, re-embedding its text with NVIDIA.
// The source namespace is left as it is.
// Usage: node --env-file=.env.local scripts/reembed_pinecone.ts [from] [to]
import { Pinecone } from "@pinecone-database/pinecone";

const from = process.argv[2] ?? "study-material-mistral";
const to = process.argv[3] ?? "study-material-nvidia";
const model = process.env.NVIDIA_EMBEDDING_MODEL || "nvidia/nemotron-3.5-embed-1b";

const index = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! }).index(process.env.PINECONE_INDEX!);
const source = index.namespace(from);
const target = index.namespace(to);

async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts, input_type: "passage", encoding_format: "float", truncate: "END", dimensions: 1024 }),
  });
  if (!res.ok) throw new Error(`NVIDIA embeddings failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

let token: string | undefined;
let copied = 0;
let skipped = 0;
const rejected: string[] = [];
do {
  const page = await source.listPaginated({ limit: 64, paginationToken: token });
  token = page.pagination?.next;
  const ids = (page.vectors ?? []).map((v) => v.id!).filter(Boolean);
  if (!ids.length) continue;
  const { records } = await source.fetch(ids);
  const rows = Object.values(records).filter((r) => typeof r.metadata?.text === "string" && r.metadata.text);
  skipped += ids.length - rows.length;
  if (!rows.length) continue;
  const texts = rows.map((r) => r.metadata!.text as string);
  // NVIDIA's safety screen can reject one chunk and fail the whole batch, so retry those one by one
  const vectors = await embed(texts).catch(() => Promise.all(texts.map((t) => embed([t]).then((v) => v[0], () => null))));
  const ok = rows.flatMap((r, i) => (vectors[i] ? [{ id: r.id, values: vectors[i]!, metadata: r.metadata }] : []));
  rejected.push(...rows.filter((_, i) => !vectors[i]).map((r) => r.id));
  if (ok.length) await target.upsert(ok);
  copied += ok.length;
  console.log(`copied ${copied}, rejected ${rejected.length}, skipped ${skipped} without text`);
} while (token);

console.log(`Done: ${copied} chunks from "${from}" to "${to}", ${skipped} skipped, ${rejected.length} rejected.`);
if (rejected.length) console.log("Rejected ids:", rejected.join(" "));
