import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Status and JSON body for a thrown error. Shared by JSON handlers and streaming routes. */
export function errorBody(err: unknown): { status: number; body: { error: string; details?: unknown } } {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  if (err instanceof ZodError) return { status: 400, body: { error: "Invalid input", details: err.flatten() } };
  console.error(err);
  // Gemini free tier allows only a few requests per minute
  const text = err instanceof Error ? err.message : "";
  if ((err as { status?: number })?.status === 429 || /\b429\b|quota/i.test(text)) {
    return { status: 429, body: { error: "Vac is busy right now (AI rate limit). Please try again in about 20 seconds." } };
  }
  const message = err instanceof Error && err.message.startsWith("Missing env var") ? err.message : "Something went wrong. Please try again.";
  return { status: 500, body: { error: message } };
}

/** Wraps an App Router handler so thrown errors become clean JSON responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      const { status, body } = errorBody(err);
      return NextResponse.json(body, { status });
    }
  };
}
