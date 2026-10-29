import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Location } from "@/db/schema";
import { buildSteps, findShortestPath, type GraphNode } from "@/lib/routing";
import { findLocationByRef } from "./locations";

const { routeNodes, routeEdges } = schema;

type Endpoint = { id: number; slug: string; name: string; marker: { x: number; y: number } };

const endpoint = (l: Location): Endpoint => ({
  id: l.id,
  slug: l.slug,
  name: l.name,
  marker: { x: l.markerX, y: l.markerY },
});

export type RouteResult =
  | { kind: "not_found"; missing: "from" | "to" }
  | {
      kind: "unavailable";
      body: {
        status: "route_unavailable";
        reason: string;
        from: Endpoint;
        to: Endpoint;
        waypoints: [];
      };
    }
  | {
      kind: "ok";
      body: {
        status: "ok";
        route_status: "verified" | "simulation" | "needs_review";
        from: Endpoint;
        to: Endpoint;
        floor_id: number;
        distance: number;
        distance_unit: "map_units";
        waypoints: { node_id: number; x: number; y: number }[];
        steps: string[];
        notice: string;
      };
    };

const unavailable = (from: Location, to: Location, reason: string): RouteResult => ({
  kind: "unavailable",
  body: { status: "route_unavailable", reason, from: endpoint(from), to: endpoint(to), waypoints: [] },
});

/**
 * Menghitung rute antar-lokasi memakai graph yang tersimpan di database.
 * Tidak pernah membuat garis tebakan: bila graph tidak menghubungkan kedua titik,
 * hasilnya `route_unavailable`.
 */
export async function computeRoute(fromRef: string, toRef: string): Promise<RouteResult> {
  const [from, to] = await Promise.all([findLocationByRef(fromRef), findLocationByRef(toRef)]);
  if (!from) return { kind: "not_found", missing: "from" };
  if (!to) return { kind: "not_found", missing: "to" };

  if (from.floorId !== to.floorId) {
    return unavailable(from, to, "Navigasi lintas lantai belum didukung.");
  }
  if (from.entryNodeId === null) {
    return unavailable(from, to, from.routeNote ?? `Titik masuk ${from.name} belum dipetakan, rute belum tersedia.`);
  }
  if (to.entryNodeId === null) {
    return unavailable(from, to, to.routeNote ?? `Titik masuk ${to.name} belum dipetakan, rute belum tersedia.`);
  }

  const db = getDb();
  const [nodes, edges] = await Promise.all([
    db.select().from(routeNodes).where(eq(routeNodes.floorId, from.floorId)),
    db.select().from(routeEdges).where(eq(routeEdges.floorId, from.floorId)),
  ]);

  const result = findShortestPath(nodes, edges, from.entryNodeId, to.entryNodeId);
  if (!result.found) {
    return unavailable(
      from,
      to,
      "Belum ada jalur koridor yang terdata menghubungkan kedua lokasi ini. Rute belum tersedia / belum terverifikasi.",
    );
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const pathNodes = result.nodeIds.map((id) => nodeById.get(id)!) as GraphNode[];
  const pathEdges = result.edgeIds.map((id) => edgeById.get(id)!);

  const statuses = [...pathNodes, ...pathEdges].map((x) => x.verificationStatus);
  let routeStatus: "verified" | "simulation" | "needs_review";
  if (from.needsRouteReview || to.needsRouteReview || statuses.includes("outdated")) {
    routeStatus = "needs_review";
  } else if (statuses.every((s) => s === "verified")) {
    routeStatus = "verified";
  } else {
    routeStatus = "simulation";
  }

  const notice = {
    verified: "Jalur ini sudah diverifikasi pengelola data.",
    simulation: "Simulasi: rute demo berdasarkan data jalur yang belum divalidasi di lokasi.",
    needs_review:
      "Perlu verifikasi ulang: ada perubahan data di sepanjang rute ini. Gunakan sebagai gambaran umum saja.",
  }[routeStatus];

  const fromLabel = from.shortName ?? from.name;
  const toLabel = to.shortName ?? to.name;

  return {
    kind: "ok",
    body: {
      status: "ok",
      route_status: routeStatus,
      from: endpoint(from),
      to: endpoint(to),
      floor_id: from.floorId,
      distance: Number(result.cost.toFixed(4)),
      distance_unit: "map_units",
      waypoints: pathNodes.map((n) => ({ node_id: n.id, x: n.x, y: n.y })),
      steps: buildSteps(pathNodes, fromLabel, toLabel),
      notice,
    },
  };
}
