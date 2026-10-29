import { eq, inArray, notInArray, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { getDb } from "./index";
import * as s from "./schema";
import * as data from "./seed-data";
import { segmentLength } from "../lib/routing";

type Db = ReturnType<typeof getDb>;

/**
 * Menyinkronkan data peta (gedung, lantai, node, edge, lokasi) dari seed-data.ts.
 * Idempoten: hanya berjalan bila SEED_VERSION berubah (atau force = true).
 * Lokasi di-upsert berdasarkan slug sehingga ID dan laporan yang terkait tetap terjaga.
 */
export async function syncMapData(db: Db, { force = false } = {}) {
  const [meta] = await db.select().from(s.appMeta).where(eq(s.appMeta.key, "seed_version"));
  if (!force && meta?.value === data.SEED_VERSION) {
    console.log(`[seed] Data peta sudah versi ${data.SEED_VERSION}, dilewati.`);
    return false;
  }

  await db.transaction(async (tx) => {
    const [building] = await tx
      .insert(s.buildings)
      .values(data.building)
      .onConflictDoUpdate({
        target: s.buildings.slug,
        set: { name: data.building.name, campus: data.building.campus },
      })
      .returning();

    const [floor] = await tx
      .insert(s.floors)
      .values({ ...data.floor, buildingId: building.id })
      .onConflictDoUpdate({
        target: [s.floors.buildingId, s.floors.number],
        set: {
          name: data.floor.name,
          mapAsset: data.floor.mapAsset,
          mapSourceLabel: data.floor.mapSourceLabel,
          width: data.floor.width,
          height: data.floor.height,
          mapSourceNote: data.floor.mapSourceNote,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Node: upsert berdasarkan kode, hapus yang sudah tidak ada di seed.
    const nodeIdByCode = new Map<string, number>();
    for (const n of data.nodes) {
      const [row] = await tx
        .insert(s.routeNodes)
        .values({
          floorId: floor.id,
          code: n.code,
          label: n.label ?? null,
          x: n.x,
          y: n.y,
          kind: n.kind,
          verificationStatus: "unverified",
          sourceType: "demo_simulation",
        })
        .onConflictDoUpdate({
          target: s.routeNodes.code,
          set: {
            floorId: floor.id,
            label: n.label ?? null,
            x: n.x,
            y: n.y,
            kind: n.kind,
            verificationStatus: "unverified",
            sourceType: "demo_simulation",
          },
        })
        .returning({ id: s.routeNodes.id });
      nodeIdByCode.set(n.code, row.id);
    }

    // Edge: dibangun ulang penuh dari seed (tidak ada tabel lain yang merujuk edge).
    await tx.delete(s.routeEdges).where(eq(s.routeEdges.floorId, floor.id));
    const nodeByCode = new Map(data.nodes.map((n) => [n.code, n]));
    for (const [a, b] of data.edges) {
      const na = nodeByCode.get(a);
      const nb = nodeByCode.get(b);
      if (!na || !nb) throw new Error(`[seed] Edge merujuk node tidak dikenal: ${a} – ${b}`);
      await tx.insert(s.routeEdges).values({
        floorId: floor.id,
        fromNodeId: nodeIdByCode.get(a)!,
        toNodeId: nodeIdByCode.get(b)!,
        cost: Number(segmentLength(na, nb).toFixed(4)),
        isActive: true,
        verificationStatus: "unverified",
        sourceType: "demo_simulation",
      });
    }

    // Lokasi: upsert berdasarkan slug.
    for (const loc of data.locations) {
      const entryNodeId = loc.entryNodeCode ? nodeIdByCode.get(loc.entryNodeCode) ?? null : null;
      const values = {
        floorId: floor.id,
        slug: loc.slug,
        name: loc.name,
        shortName: loc.shortName ?? null,
        aliases: loc.aliases ?? null,
        type: loc.type,
        description: loc.description,
        markerX: loc.markerX,
        markerY: loc.markerY,
        entryNodeId,
        routeNote: loc.routeNote ?? null,
        verificationStatus: "unverified" as const,
        sourceType: "reference_map" as const,
        needsRouteReview: false,
        updatedAt: new Date(),
      };
      await tx
        .insert(s.locations)
        .values(values)
        .onConflictDoUpdate({ target: s.locations.slug, set: values });
    }

    // Lokasi yang sudah tidak ada di seed dihapus (laporan terkait tetap tersimpan, location_id menjadi null).
    await tx
      .delete(s.locations)
      .where(and(eq(s.locations.floorId, floor.id), notInArray(s.locations.slug, data.locations.map((l) => l.slug))));

    const nodeCodes = data.nodes.map((n) => n.code);
    await tx
      .delete(s.routeNodes)
      .where(and(eq(s.routeNodes.floorId, floor.id), notInArray(s.routeNodes.code, nodeCodes)));

    await tx
      .insert(s.appMeta)
      .values({ key: "seed_version", value: data.SEED_VERSION })
      .onConflictDoUpdate({ target: s.appMeta.key, set: { value: data.SEED_VERSION } });
  });

  console.log(`[seed] Data peta disinkronkan ke versi ${data.SEED_VERSION}.`);
  return true;
}

/** Membuat akun admin dari variabel lingkungan bila belum ada. */
export async function ensureAdmin(db: Db) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("[seed] ADMIN_EMAIL/ADMIN_PASSWORD tidak diatur, akun admin tidak dibuat.");
    return;
  }
  if (password.length < 10) {
    throw new Error("[seed] ADMIN_PASSWORD minimal 10 karakter.");
  }
  const existing = await db.select({ id: s.admins.id }).from(s.admins).where(inArray(s.admins.email, [email]));
  if (existing.length > 0) {
    console.log(`[seed] Admin ${email} sudah ada.`);
    return;
  }
  await db.insert(s.admins).values({
    email,
    name: process.env.ADMIN_NAME?.trim() || "Admin",
    passwordHash: await bcrypt.hash(password, 12),
  });
  console.log(`[seed] Admin ${email} dibuat.`);
}
