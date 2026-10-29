import { NextResponse, type NextRequest } from "next/server";
import { apiError, withErrorHandling } from "@/lib/http";
import { locationRefSchema } from "@/lib/validation";
import { findLocationByRef, serializeLocation } from "@/server/locations";

/** GET /api/locations/{id|slug} — detail lokasi beserta status verifikasi. */
export const GET = withErrorHandling(async (_req: NextRequest, ctx: RouteContext<"/api/locations/[id]">) => {
  const parsed = locationRefSchema.safeParse((await ctx.params).id);
  if (!parsed.success) return apiError(400, "bad_request", "ID lokasi tidak valid.");
  const row = await findLocationByRef(parsed.data);
  if (!row) return apiError(404, "not_found", "Lokasi tidak ditemukan.");
  return NextResponse.json({ data: serializeLocation(row) }, { headers: { "Cache-Control": "no-store" } });
});
