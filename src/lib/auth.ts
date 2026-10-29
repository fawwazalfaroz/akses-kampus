import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { apiError } from "./http";

export const SESSION_COOKIE = "ak_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 jam

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET belum diatur atau kurang dari 32 karakter.");
  }
  return new TextEncoder().encode(secret);
}

export type AdminSession = { adminId: number; email: string; name: string };

export async function createSessionToken(session: AdminSession) {
  return new SignJWT({ email: session.email, name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.adminId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setIssuer("akses-kampus")
    .setAudience("akses-kampus-admin")
    .sign(secretKey());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** Membaca dan memverifikasi sesi admin dari cookie. Null bila tidak valid. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "akses-kampus",
      audience: "akses-kampus-admin",
      algorithms: ["HS256"],
    });
    const adminId = Number(payload.sub);
    if (!Number.isInteger(adminId)) return null;
    // Pastikan akun admin masih ada di database.
    const [admin] = await getDb()
      .select({ id: schema.admins.id, email: schema.admins.email, name: schema.admins.name })
      .from(schema.admins)
      .where(eq(schema.admins.id, adminId));
    if (!admin) return null;
    return { adminId: admin.id, email: admin.email, name: admin.name };
  } catch {
    return null;
  }
}

/** Dipakai di route handler admin: mengembalikan sesi atau respons 401. */
export async function requireAdmin(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: Response }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: apiError(401, "unauthorized", "Login admin diperlukan."),
    };
  }
  return { ok: true, session };
}
