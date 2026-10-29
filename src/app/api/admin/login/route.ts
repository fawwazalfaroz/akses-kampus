import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "@/db";
import { apiError, clientIp, isSameOrigin, readJson, validationError, withErrorHandling } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

// Hash bcrypt tiruan agar waktu respons sama saat email tidak terdaftar.
const DUMMY_HASH = "$2b$12$kXcTBX0LMItZS4HmD24w8OqTkak85c5CfpyKNWRFz4Xdnpx84CBje";

/** POST /api/admin/login — login admin, membuat cookie sesi HttpOnly. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSameOrigin(request)) return apiError(403, "forbidden", "Origin tidak diizinkan.");
  const body = await readJson(request, 2_000);
  if (!body.ok) return body.response;
  const parsed = loginSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const limit = await checkRateLimit(`login:${hashIp(clientIp(request))}`, 8, 15 * 60);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Terlalu banyak percobaan login. Coba lagi nanti.", undefined, {
      "Retry-After": String(limit.retryAfter),
    });
  }

  const [admin] = await getDb()
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.email, parsed.data.email));
  const valid = await bcrypt.compare(parsed.data.password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !valid) return apiError(401, "unauthorized", "Email atau password salah.");

  const token = await createSessionToken({ adminId: admin.id, email: admin.email, name: admin.name });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.json({ data: { id: admin.id, email: admin.email, name: admin.name } });
});
