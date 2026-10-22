type ServerEnvKey =
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "AUTH_SECRET"
  | "SUPABASE_URL"
  | "SUPABASE_SECRET_KEY"
  | "GEMINI_API_KEY"
  | "PINECONE_API_KEY"
  | "MISTRAL_API_KEY"
  | "PINECONE_INDEX";

/** Reads a required server env var and fails with a clear message if it is missing. */
export function requireEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value || value.startsWith("your-") || value.startsWith("replace-")) {
    throw new Error(`Missing env var ${key}. Fill it in .env.local (see .env.example).`);
  }
  return value;
}

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const embeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
/** Vac agent model. Mistral by default so chat does not use up the Gemini daily quota. */
export const agentProvider = () => (process.env.AGENT_PROVIDER === "gemini" ? "gemini" : "mistral");
export const agentModelName = () => process.env.AGENT_MODEL || "ministral-8b-latest";
/** Must match the ML service: documents and questions are embedded by the same provider. */
export const embeddingProvider = () => (process.env.EMBEDDING_PROVIDER === "gemini" ? "gemini" : "mistral");
export const pineconeNamespace = () => process.env.PINECONE_NAMESPACE || "study-material-mistral";

export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const isPineconeConfigured = () =>
  Boolean(process.env.PINECONE_API_KEY && !process.env.PINECONE_API_KEY.startsWith("your-"));
