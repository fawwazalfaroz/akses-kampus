import { NextResponse, type NextRequest } from "next/server";
import { apiError, clientIp, isSameOrigin, readJson, validationError, withErrorHandling } from "@/lib/http";
import { reportCreateSchema } from "@/lib/validation";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";
import { createReport } from "@/server/reports";

const REPORT_LIMIT = 5; // laporan
const REPORT_WINDOW_SECONDS = 10 * 60; // per 10 menit per IP

/**
 * POST /api/reports — mengirim laporan perubahan.
 * Laporan tersimpan berstatus "pending"; data publik baru berubah setelah admin menyetujui.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSameOrigin(request)) return apiError(403, "forbidden", "Origin tidak diizinkan.");

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = reportCreateSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const ipHash = hashIp(clientIp(request));
  const limit = await checkRateLimit(`report:${ipHash}`, REPORT_LIMIT, REPORT_WINDOW_SECONDS);
  if (!limit.allowed) {
    return apiError(
      429,
      "rate_limited",
      "Terlalu banyak laporan dari perangkat ini. Coba lagi beberapa menit lagi.",
      undefined,
      { "Retry-After": String(limit.retryAfter) },
    );
  }

  const result = await createReport(parsed.data, ipHash);
  if (!result.ok) return apiError(404, "not_found", "Lokasi yang dilaporkan tidak ditemukan.");

  return NextResponse.json(
    {
      data: result.report,
      message: "Laporan diterima dan menunggu peninjauan admin. Informasi publik belum berubah.",
    },
    { status: 201 },
  );
});
