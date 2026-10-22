import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatMistralAI } from "@langchain/mistralai";
import { agentModelName, agentProvider, embeddingModel, embeddingProvider, geminiModel, requireEnv } from "../env";

/** Gemini chat model. Lower temperature for tools and grading, higher for creative tasks. */
export function chatModel(temperature = 0.3) {
  return new ChatGoogleGenerativeAI({
    model: geminiModel(),
    apiKey: requireEnv("GEMINI_API_KEY"),
    temperature,
    maxRetries: 2,
  });
}

/**
 * Model for the Vac agent. It makes the most calls (several per chat turn), so by default it runs on
 * Mistral's ministral-8b (188 requests/min on the free plan) and keeps Gemini's small daily quota
 * for quizzes, plans, doubts and grounded answers. Set AGENT_PROVIDER=gemini to switch back.
 */
export function agentModel(temperature = 0.3) {
  if (agentProvider() === "gemini") return chatModel(temperature);
  return new ChatMistralAI({
    model: agentModelName(),
    apiKey: requireEnv("MISTRAL_API_KEY"),
    temperature,
    maxRetries: 2,
  });
}

type Embedder = { embedQuery: (text: string) => Promise<number[]>; embedDocuments: (texts: string[]) => Promise<number[][]> };

/** Mistral embeddings (mistral-embed, 1024 dims) through the REST API. */
const mistralEmbedder: Embedder = {
  async embedDocuments(texts) {
    const res = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${requireEnv("MISTRAL_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.MISTRAL_EMBEDDING_MODEL || "mistral-embed", input: texts }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const error = new Error(`Mistral embeddings failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      Object.assign(error, { status: res.status });
      throw error;
    }
    const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  },
  async embedQuery(text) {
    return (await this.embedDocuments([text]))[0];
  },
};

let geminiEmbedder: GoogleGenerativeAIEmbeddings | null = null;

/**
 * Embeddings for search queries. The provider must match the one the ML service used for the
 * documents (EMBEDDING_PROVIDER), otherwise the vectors are not comparable. Both give 1024 dims.
 */
export function embedder(): Embedder {
  if (embeddingProvider() === "mistral") return mistralEmbedder;
  if (!geminiEmbedder) {
    geminiEmbedder = new GoogleGenerativeAIEmbeddings({
      model: embeddingModel(),
      apiKey: requireEnv("GEMINI_API_KEY"),
      outputDimensionality: 1024,
    });
  }
  return geminiEmbedder;
}

/** LangChain message content can be a string or a list of parts. This returns plain text. */
export function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part && typeof part === "object" && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
}
