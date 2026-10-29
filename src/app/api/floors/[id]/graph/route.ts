import { NextResponse, type NextRequest } from "next/server";
import { apiError, withErrorHandling } from "@/lib/http";
import { idParamSchema } from "@/lib/validation";
import { getFloor, getFloorGraph } from "@/server/locations";

/** GET /api/floors/{id}/graph — node dan edge aktif (jaringan jalur) satu lantai. */
export const GET = withErrorHandling(async (_req: NextRequest, ctx: RouteContext<"/api/floors/[id]/graph">) => {
  const parsed = idParamSchema.safeParse((await ctx.params).id);
  if (!parsed.success) return apiError(400, "bad_request", "ID lantai tidak valid.");
  if (!(await getFloor(parsed.data))) return apiError(404, "not_found", "Lantai tidak ditemukan.");
  const graph = await getFloorGraph(parsed.data);
  return NextResponse.json({ data: graph }, { headers: { "Cache-Control": "no-store" } });
});
