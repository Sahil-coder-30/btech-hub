import { createHash, timingSafeEqual } from "node:crypto";

type ServerEnvKey =
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "AUTH_SECRET"
  | "SUPABASE_URL"
  | "SUPABASE_SECRET_KEY"
  | "GEMINI_API_KEY"
  | "PINECONE_API_KEY"
  | "NVIDIA_API_KEY"
  | "PINECONE_INDEX";

/** Reads a required server env var and fails with a clear message if it is missing. */
export function requireEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value || value.startsWith("your-") || value.startsWith("replace-")) {
    throw new Error(`Missing env var ${key}. Fill it in .env.local (see .env.example).`);
  }
  return value;
}

export const appUrl = () => {
  const nextPublicUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (nextPublicUrl && !nextPublicUrl.includes("localhost")) {
    return nextPublicUrl.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }
  const fallback = nextPublicUrl || "http://localhost:3000";
  return (fallback.startsWith("http") ? fallback : `https://${fallback}`).replace(/\/$/, "");
};

export const geminiModel = () => {
  const model = process.env.GEMINI_MODEL;
  if (!model || model.includes("1.5") || model.includes("3.8") || model.includes("3.7") || model.includes("2.5")) {
    return "gemini-3.5-flash-lite";
  }
  return model;
};
/** Main model for quizzes, doubts, plans and grounded answers. NVIDIA by default, Gemini is its backup. */
export const llmProvider = () => (process.env.LLM_PROVIDER === "gemini" ? "gemini" : "nvidia");
export const nvidiaModelName = () => process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";
export const embeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
/** Vac agent model. NVIDIA by default, AGENT_PROVIDER=gemini uses Gemini alone. */
export const agentProvider = () => (process.env.AGENT_PROVIDER === "gemini" ? "gemini" : "nvidia");
/** Documents and questions must be embedded by the same provider. NVIDIA by default. */
export const embeddingProvider = () => (process.env.EMBEDDING_PROVIDER === "gemini" ? "gemini" : "nvidia");
export const nvidiaEmbeddingModel = () => process.env.NVIDIA_EMBEDDING_MODEL || "nvidia/nemotron-3.5-embed-1b";
// Tied to the provider so a query never searches vectors made by another model
export const pineconeNamespace = () => `study-material-${embeddingProvider()}`;

export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * Direct admin login check. No default credentials: when ADMIN_USERNAME or ADMIN_PASSWORD
 * is missing (or the password is under 12 chars) admin login is turned off.
 * Hashing first makes both sides the same length so timingSafeEqual never throws.
 */
export function isValidAdminLogin(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword || expectedPassword.length < 12) return false;
  const userOk = timingSafeEqual(sha256(username), sha256(expectedUser));
  const passwordOk = timingSafeEqual(sha256(password), sha256(expectedPassword));
  return userOk && passwordOk;
}

export const isPineconeConfigured = () =>
  Boolean(process.env.PINECONE_API_KEY && !process.env.PINECONE_API_KEY.startsWith("your-"));
