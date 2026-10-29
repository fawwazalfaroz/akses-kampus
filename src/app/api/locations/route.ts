import { NextResponse, type NextRequest } from "next/server";
import { validationError, withErrorHandling } from "@/lib/http";
import { locationQuerySchema } from "@/lib/validation";
import { listLocations } from "@/server/locations";

/** GET /api/locations?floor_id=1&q=library&type=library — pencarian & filter lokasi. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = locationQuerySchema.safeParse(params);
  if (!parsed.success) return validationError(parsed.error);
  const { floor_id, q, type } = parsed.data;
  const data = await listLocations({ floorId: floor_id, q: q || undefined, type });
  return NextResponse.json(
    { data, meta: { count: data.length, query: q ?? null } },
    { headers: { "Cache-Control": "no-store" } },
  );
});
