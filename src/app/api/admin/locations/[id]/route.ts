import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { apiError, isSameOrigin, readJson, validationError, withErrorHandling } from "@/lib/http";
import { idParamSchema, locationUpdateSchema } from "@/lib/validation";
import { serializeLocation } from "@/server/locations";

const { locations, auditLogs } = schema;

/** PATCH /api/admin/locations/{id} — ubah detail lokasi (butuh login). */
export const PATCH = withErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/locations/[id]">) => {
  if (!isSameOrigin(request)) return apiError(403, "forbidden", "Origin tidak diizinkan.");
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const id = idParamSchema.safeParse((await ctx.params).id);
  if (!id.success) return apiError(400, "bad_request", "ID lokasi tidak valid.");
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = locationUpdateSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const v = parsed.data;
  const update: Partial<typeof locations.$inferInsert> = { updatedAt: new Date() };
  if (v.name !== undefined) update.name = v.name;
  if (v.short_name !== undefined) update.shortName = v.short_name || null;
  if (v.aliases !== undefined) update.aliases = v.aliases || null;
  if (v.type !== undefined) update.type = v.type;
  if (v.description !== undefined) update.description = v.description || null;
  if (v.marker_x !== undefined) update.markerX = v.marker_x;
  if (v.marker_y !== undefined) update.markerY = v.marker_y;
  if (v.verification_status !== undefined) update.verificationStatus = v.verification_status;
  if (v.source_type !== undefined) update.sourceType = v.source_type;
  if (v.needs_route_review !== undefined) update.needsRouteReview = v.needs_route_review;

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(locations).where(eq(locations.id, id.data)).for("update");
    if (!before) return null;
    const [after] = await tx.update(locations).set(update).where(eq(locations.id, id.data)).returning();
    await tx.insert(auditLogs).values({
      adminId: auth.session.adminId,
      action: "location.update",
      entity: "location",
      entityId: id.data,
      details: { changes: v, before: serializeLocation(before) },
    });
    return after;
  });

  if (!result) return apiError(404, "not_found", "Lokasi tidak ditemukan.");
  return NextResponse.json({ data: serializeLocation(result) });
});
