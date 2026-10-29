import { NextResponse, type NextRequest } from "next/server";
import { apiError, validationError, withErrorHandling } from "@/lib/http";
import { routeQuerySchema } from "@/lib/validation";
import { computeRoute } from "@/server/routes";

/**
 * GET /api/routes?from={id|slug}&to={id|slug}
 * Mengembalikan waypoints hasil Dijkstra, atau status "route_unavailable"
 * bila graph belum menghubungkan kedua lokasi (tidak ada garis tebakan).
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const parsed = routeQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const result = await computeRoute(parsed.data.from, parsed.data.to);
  if (result.kind === "not_found") {
    return apiError(
      404,
      "not_found",
      result.missing === "from" ? "Lokasi awal tidak ditemukan." : "Lokasi tujuan tidak ditemukan.",
    );
  }
  return NextResponse.json(result.body, { headers: { "Cache-Control": "no-store" } });
});
