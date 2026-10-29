import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, isSameOrigin, readJson, validationError, withErrorHandling } from "@/lib/http";
import { idParamSchema, reportReviewSchema } from "@/lib/validation";
import { reviewReport } from "@/server/reports";

/** PATCH /api/admin/reports/{id} — setujui/tolak laporan (butuh login). */
export const PATCH = withErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/reports/[id]">) => {
  if (!isSameOrigin(request)) return apiError(403, "forbidden", "Origin tidak diizinkan.");
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const id = idParamSchema.safeParse((await ctx.params).id);
  if (!id.success) return apiError(400, "bad_request", "ID laporan tidak valid.");
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = reportReviewSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const result = await reviewReport(id.data, auth.session.adminId, parsed.data);
  if (!result.ok) {
    return result.reason === "not_found"
      ? apiError(404, "not_found", "Laporan tidak ditemukan.")
      : apiError(409, "conflict", "Laporan ini sudah ditinjau sebelumnya.");
  }
  return NextResponse.json({ data: result.report, location_updated: result.location_updated });
});
