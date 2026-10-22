import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccount } from "@/lib/account";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE } from "@/lib/session";

const bodySchema = z.object({ confirmEmail: z.string().trim().min(3).max(320) });

/** DELETE /api/account: delete the account and all its data, then log out. */
export const DELETE = handler(async (request: Request) => {
  const user = await requireUser();
  rateLimit(`delete:${clientKey(request, user.id)}`, 5);
  const { confirmEmail } = bodySchema.parse(await request.json().catch(() => ({})));
  await deleteAccount(user, confirmEmail);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
});
