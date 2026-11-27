import { AppError, BadGatewayError, ModelRateLimitError, logger, normalizeRequestId, toHttpResponse, type ErrorCoercer } from "faultkit";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { HttpError } from "./auth";

export { logger };

const GENERIC_MESSAGE = "Something went wrong. Please try again.";
const MAX_JSON_BYTES = 1024 * 1024;
// Largest upload (admin PDF) is 25 MB, plus multipart overhead
const MAX_FORM_BYTES = 26 * 1024 * 1024;

/** Maps provider and config errors faultkit cannot know about. Must stay synchronous. */
const coerce: ErrorCoercer = (err) => {
  if (err instanceof AppError) return undefined;
  const text = err instanceof Error ? err.message : "";
  const status = (err as { status?: unknown; statusCode?: unknown })?.status ?? (err as { statusCode?: unknown })?.statusCode;
  // Gemini free tier allows only a few requests per minute
  if (status === 429 || /\b429\b|quota/i.test(text)) {
    return new ModelRateLimitError("Vac is busy right now (AI rate limit). Please try again in about 20 seconds.");
  }
  // Setup problem the developer must see, so it is not masked
  if (text.startsWith("Missing env var")) return new HttpError(500, text);
  // AI SDKs and fetch clients attach the UPSTREAM status. Passing it on would leak provider messages
  // (even key fragments) and turn a bad API key into a 401 that logs our user out.
  if (typeof status === "number" || typeof status === "string") return new BadGatewayError();
  return undefined;
};

/**
 * Status and faultkit body `{ success: false, error: { code, message, details } }` for a thrown error.
 * Shared by JSON handlers and streaming routes. Unexpected errors are logged and always masked.
 */
export function errorBody(err: unknown, requestId?: string) {
  const { statusCode, body } = toHttpResponse(err, { requestId, isProduction: true, genericServerErrorMessage: GENERIC_MESSAGE, errorCoercer: coerce });
  if (!(err instanceof AppError) && !(err instanceof ZodError)) logger.error({ err, requestId, statusCode }, "request failed");
  return { status: statusCode, body };
}

/** Parsed JSON body. Broken JSON is the client's mistake: 400, not a 500. Also enforces the size limit for chunked bodies. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) throw new HttpError(413, "Request body is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }
}

/** Multipart form body. A JSON or empty body makes request.formData() throw a TypeError: that is a 400. */
export async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, "Send the form as multipart/form-data.");
  }
}

/** Refuses oversized bodies before anything reads them. */
function checkSize(request: Request | null) {
  const length = Number(request?.headers.get("content-length") ?? 0);
  const isJson = /json/i.test(request?.headers.get("content-type") ?? "");
  if (length > (isJson ? MAX_JSON_BYTES : MAX_FORM_BYTES)) throw new HttpError(413, "Request body is too large.");
}

/** Wraps an App Router handler so thrown errors become faultkit JSON responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    const request = args[0] instanceof Request ? args[0] : null;
    try {
      checkSize(request);
      return await fn(...args);
    } catch (err) {
      // A hostile client id (spaces, quotes, too long) is replaced, so header and body always match
      const requestId = normalizeRequestId(request?.headers.get("x-request-id") ?? undefined) ?? crypto.randomUUID();
      const { status, body } = errorBody(err, requestId);
      return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
    }
  };
}

/** A link students can click. z.string().url() alone accepts javascript: and data: URLs (stored XSS). */
export const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Only http and https links are allowed.");
