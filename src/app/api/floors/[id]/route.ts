import { NextResponse, type NextRequest } from "next/server";
import { apiError, withErrorHandling } from "@/lib/http";
import { idParamSchema } from "@/lib/validation";
import { getFloor } from "@/server/locations";

/** GET /api/floors/{id} — data lantai dan aset denah. */
export const GET = withErrorHandling(async (_req: NextRequest, ctx: RouteContext<"/api/floors/[id]">) => {
  const parsed = idParamSchema.safeParse((await ctx.params).id);
  if (!parsed.success) return apiError(400, "bad_request", "ID lantai tidak valid.");
  const floor = await getFloor(parsed.data);
  if (!floor) return apiError(404, "not_found", "Lantai tidak ditemukan.");
  return NextResponse.json({ data: floor }, { headers: { "Cache-Control": "no-store" } });
});
