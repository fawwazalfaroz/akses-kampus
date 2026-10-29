import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { validationError, withErrorHandling } from "@/lib/http";
import { reportListQuerySchema } from "@/lib/validation";
import { listReports } from "@/server/reports";

/** GET /api/admin/reports?status=pending|approved|rejected|all — daftar laporan (butuh login). */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const parsed = reportListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const data = await listReports(parsed.data.status);
  return NextResponse.json({ data, meta: { count: data.length } }, { headers: { "Cache-Control": "no-store" } });
});
