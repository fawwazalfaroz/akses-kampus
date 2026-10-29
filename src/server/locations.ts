import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Location } from "@/db/schema";

const { locations, floors, buildings, routeNodes, routeEdges } = schema;

export const LOCATION_TYPE_LABELS: Record<Location["type"], string> = {
  entrance: "Pintu masuk / Lobby",
  library: "Perpustakaan",
  service: "Layanan mahasiswa",
  retail: "Toko",
  bank: "Bank / ATM",
  vertical_access: "Akses vertikal",
  office: "Kantor / Administrasi",
  room: "Ruang",
  toilet: "Toilet",
  food: "Makanan & minuman",
  other: "Lainnya",
};

/** Bentuk respons API untuk lokasi (snake_case, stabil untuk klien). */
export function serializeLocation(row: Location) {
  return {
    id: row.id,
    floor_id: row.floorId,
    slug: row.slug,
    name: row.name,
    short_name: row.shortName,
    aliases: row.aliases ? row.aliases.split(",").map((a) => a.trim()).filter(Boolean) : [],
    type: row.type,
    type_label: LOCATION_TYPE_LABELS[row.type],
    description: row.description,
    marker: { x: row.markerX, y: row.markerY },
    routable: row.entryNodeId !== null,
    route_note: row.routeNote,
    verification_status: row.verificationStatus,
    source_type: row.sourceType,
    needs_route_review: row.needsRouteReview,
    updated_at: row.updatedAt.toISOString(),
  };
}

export type LocationDto = ReturnType<typeof serializeLocation>;

/** Escape karakter wildcard LIKE pada input pengguna. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listLocations(opts: { floorId?: number; q?: string; type?: Location["type"] }) {
  const filters = [];
  if (opts.floorId) filters.push(eq(locations.floorId, opts.floorId));
  if (opts.type) filters.push(eq(locations.type, opts.type));
  if (opts.q) {
    const pattern = `%${escapeLike(opts.q)}%`;
    filters.push(
      or(
        ilike(locations.name, pattern),
        ilike(locations.shortName, pattern),
        ilike(locations.aliases, pattern),
        ilike(locations.slug, pattern),
      )!,
    );
  }
  const rows = await getDb()
    .select()
    .from(locations)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(locations.name));
  return rows.map(serializeLocation);
}

/** Mencari lokasi berdasarkan ID numerik atau slug. */
export async function findLocationByRef(ref: string) {
  const db = getDb();
  const condition = /^\d+$/.test(ref) ? eq(locations.id, Number(ref)) : eq(locations.slug, ref.toLowerCase());
  const [row] = await db.select().from(locations).where(condition);
  return row ?? null;
}

export async function getFloor(floorId: number) {
  const db = getDb();
  const [row] = await db
    .select({ floor: floors, building: buildings })
    .from(floors)
    .innerJoin(buildings, eq(floors.buildingId, buildings.id))
    .where(eq(floors.id, floorId));
  if (!row) return null;
  const [counts] = await db
    .select({
      locations: sql<number>`(select count(*)::int from ${locations} where ${locations.floorId} = ${floorId})`,
      nodes: sql<number>`(select count(*)::int from ${routeNodes} where ${routeNodes.floorId} = ${floorId})`,
      edges: sql<number>`(select count(*)::int from ${routeEdges} where ${routeEdges.floorId} = ${floorId} and ${routeEdges.isActive})`,
    })
    .from(sql`(select 1) as one`);
  return {
    id: row.floor.id,
    number: row.floor.number,
    name: row.floor.name,
    building: { id: row.building.id, slug: row.building.slug, name: row.building.name, campus: row.building.campus },
    map: {
      asset: row.floor.mapAsset,
      width: row.floor.width,
      height: row.floor.height,
      coordinate_system: "relative_0_1",
      source_label: row.floor.mapSourceLabel,
      source_note: row.floor.mapSourceNote,
      verification_status: row.floor.mapVerificationStatus,
    },
    stats: counts,
    updated_at: row.floor.updatedAt.toISOString(),
  };
}

/** Node dan edge aktif satu lantai, untuk visualisasi jaringan jalur. */
export async function getFloorGraph(floorId: number) {
  const db = getDb();
  const [nodes, edges] = await Promise.all([
    db.select().from(routeNodes).where(eq(routeNodes.floorId, floorId)),
    db.select().from(routeEdges).where(and(eq(routeEdges.floorId, floorId), eq(routeEdges.isActive, true))),
  ]);
  return {
    floor_id: floorId,
    nodes: nodes.map((n) => ({
      id: n.id,
      code: n.code,
      label: n.label,
      x: n.x,
      y: n.y,
      kind: n.kind,
      verification_status: n.verificationStatus,
      source_type: n.sourceType,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.fromNodeId,
      to: e.toNodeId,
      cost: e.cost,
      verification_status: e.verificationStatus,
      source_type: e.sourceType,
    })),
  };
}
