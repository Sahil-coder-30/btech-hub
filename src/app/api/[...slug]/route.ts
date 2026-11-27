import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";

/** Any /api path without its own route: the JSON 404 envelope instead of the HTML not-found page. */
const notFound = handler(async () => {
  throw new HttpError(404, "API route not found.");
});

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
