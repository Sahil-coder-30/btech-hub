import { AppError, ModelRateLimitError, logger, toHttpResponse, type ErrorCoercer } from "faultkit";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

export { logger };

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/** Maps provider and config errors faultkit cannot know about. Must stay synchronous. */
const coerce: ErrorCoercer = (err) => {
  if (err instanceof AppError) return undefined;
  const text = err instanceof Error ? err.message : "";
  // Gemini free tier allows only a few requests per minute
  if ((err as { status?: number })?.status === 429 || /\b429\b|quota/i.test(text)) {
    return new ModelRateLimitError("Vac is busy right now (AI rate limit). Please try again in about 20 seconds.");
  }
  // Setup problem the developer must see, so it is not masked
  if (text.startsWith("Missing env var")) return new HttpError(500, text);
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

/** Wraps an App Router handler so thrown errors become faultkit JSON responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      const request = args[0] instanceof Request ? args[0] : null;
      const requestId = request?.headers.get("x-request-id") ?? crypto.randomUUID();
      const { status, body } = errorBody(err, requestId);
      return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
    }
  };
}
