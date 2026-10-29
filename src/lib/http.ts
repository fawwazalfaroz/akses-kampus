import { connection, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "bad_request"
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "unsupported_media_type"
  | "server_error";

/** Format error API yang seragam: { error: { code, message, details? } } */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status, headers },
  );
}

export function validationError(err: ZodError) {
  return apiError(
    400,
    "validation_error",
    "Input tidak valid.",
    err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  );
}

/** Membaca body JSON dengan batas ukuran, menolak content-type selain JSON. */
export async function readJson(request: Request, maxBytes = 8_000): Promise<
  { ok: true; data: unknown } | { ok: false; response: NextResponse }
> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: apiError(415, "unsupported_media_type", "Content-Type harus application/json."),
    };
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    return { ok: false, response: apiError(413 as number, "bad_request", "Ukuran body terlalu besar.") };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, response: apiError(400, "bad_request", "Body bukan JSON yang valid.") };
  }
}

/**
 * Perlindungan CSRF sederhana untuk request yang mengubah data:
 * header Origin (bila ada) harus sama dengan host aplikasi.
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // klien non-browser (curl/Postman) tidak mengirim Origin
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Membungkus route handler API:
 * - selalu dijalankan per request (tidak di-prerender saat build),
 * - error tak terduga dicatat di server tanpa membocorkan detail ke klien.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args) => {
    await connection();
    try {
      return await handler(...args);
    } catch (err) {
      unstable_rethrow(err);
      console.error("[api]", err);
      return apiError(500, "server_error", "Terjadi kesalahan pada server.");
    }
  };
}

/** Mengambil IP klien dari header proxy (Vercel mengisi x-forwarded-for). */
export function clientIp(request: Request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
