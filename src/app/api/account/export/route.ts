import { exportUserData } from "@/lib/account";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/** GET /api/account/export: everything stored about the student as a JSON download. */
export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  // Own bucket so exports do not eat into the AI routes' per-user limit
  rateLimit(`export:${clientKey(request, user.id)}`, 3);
  const data = await exportUserData(user);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="btech-hub-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
