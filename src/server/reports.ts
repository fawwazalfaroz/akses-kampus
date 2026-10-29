import { desc, eq, inArray, or } from "drizzle-orm";
import type { z } from "zod";
import { getDb, schema } from "@/db";
import type { reportCreateSchema, reportReviewSchema } from "@/lib/validation";

const { reports, locations, routeEdges, auditLogs, admins } = schema;

export const REPORT_CATEGORY_LABELS = {
  wrong_name: "Nama salah",
  moved: "Ruangan pindah",
  facility_changed: "Fasilitas berubah",
  other: "Lainnya",
} as const;

export async function createReport(input: z.output<typeof reportCreateSchema>, ipHash: string) {
  const db = getDb();
  if (input.location_id) {
    const [loc] = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, input.location_id));
    if (!loc) return { ok: false as const, reason: "location_not_found" as const };
  }
  const [row] = await db
    .insert(reports)
    .values({
      locationId: input.location_id ?? null,
      category: input.category,
      description: input.description,
      suggestedName: input.suggested_name ?? null,
      status: "pending",
      ipHash,
    })
    .returning();
  return {
    ok: true as const,
    report: { id: row.id, status: row.status, created_at: row.createdAt.toISOString() },
  };
}

export async function listReports(status: "pending" | "approved" | "rejected" | "all") {
  const db = getDb();
  const rows = await db
    .select({ report: reports, location: locations, reviewer: { name: admins.name } })
    .from(reports)
    .leftJoin(locations, eq(reports.locationId, locations.id))
    .leftJoin(admins, eq(reports.reviewedBy, admins.id))
    .where(status === "all" ? undefined : eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(200);
  return rows.map(({ report, location, reviewer }) => ({
    id: report.id,
    category: report.category,
    category_label: REPORT_CATEGORY_LABELS[report.category],
    description: report.description,
    suggested_name: report.suggestedName,
    status: report.status,
    created_at: report.createdAt.toISOString(),
    reviewed_at: report.reviewedAt?.toISOString() ?? null,
    reviewed_by: reviewer?.name ?? null,
    admin_note: report.adminNote,
    location: location
      ? {
          id: location.id,
          slug: location.slug,
          name: location.name,
          short_name: location.shortName,
          description: location.description,
          type: location.type,
          verification_status: location.verificationStatus,
        }
      : null,
  }));
}

/**
 * Menyetujui/menolak laporan. Saat disetujui, perubahan lokasi diterapkan dalam
 * transaksi yang sama, dan bila perubahan memengaruhi jalur, rute terkait ditandai
 * perlu verifikasi ulang. Semua perubahan dicatat di audit_logs.
 */
export async function reviewReport(
  reportId: number,
  adminId: number,
  input: z.output<typeof reportReviewSchema>,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(reports).where(eq(reports.id, reportId)).for("update");
    if (!report) return { ok: false as const, reason: "not_found" as const };
    if (report.status !== "pending") return { ok: false as const, reason: "already_reviewed" as const };

    const applied: Record<string, unknown> = {};
    if (input.action === "approve" && report.locationId) {
      const [loc] = await tx.select().from(locations).where(eq(locations.id, report.locationId));
      const changes = input.location_changes ?? {};
      const update: Partial<typeof locations.$inferInsert> = {};
      if (changes.name !== undefined) update.name = changes.name;
      if (changes.short_name !== undefined) update.shortName = changes.short_name;
      if (changes.description !== undefined) update.description = changes.description;
      if (changes.type !== undefined) update.type = changes.type;
      if (changes.verification_status !== undefined) update.verificationStatus = changes.verification_status;

      const flagRoute = input.flag_route_review ?? report.category === "moved";
      if (flagRoute) {
        update.needsRouteReview = true;
        if (loc?.entryNodeId) {
          // Koridor yang menyentuh titik masuk lokasi ditandai usang.
          await tx
            .update(routeEdges)
            .set({ verificationStatus: "outdated" })
            .where(or(eq(routeEdges.fromNodeId, loc.entryNodeId), eq(routeEdges.toNodeId, loc.entryNodeId)));
        }
      }

      if (Object.keys(update).length > 0) {
        update.updatedAt = new Date();
        await tx.update(locations).set(update).where(eq(locations.id, report.locationId));
        Object.assign(applied, update, { before: loc ? { name: loc.name, description: loc.description } : null });
      }
    }

    const [updated] = await tx
      .update(reports)
      .set({
        status: input.action === "approve" ? "approved" : "rejected",
        reviewedAt: new Date(),
        reviewedBy: adminId,
        adminNote: input.admin_note || null,
      })
      .where(eq(reports.id, reportId))
      .returning();

    await tx.insert(auditLogs).values({
      adminId,
      action: input.action === "approve" ? "report.approve" : "report.reject",
      entity: "report",
      entityId: reportId,
      details: { location_id: report.locationId, applied },
    });

    return {
      ok: true as const,
      report: {
        id: updated.id,
        status: updated.status,
        reviewed_at: updated.reviewedAt?.toISOString() ?? null,
        admin_note: updated.adminNote,
      },
      location_updated: Object.keys(applied).length > 0,
    };
  });
}

export async function countPendingReports() {
  const db = getDb();
  const rows = await db.select({ id: reports.id }).from(reports).where(inArray(reports.status, ["pending"]));
  return rows.length;
}
