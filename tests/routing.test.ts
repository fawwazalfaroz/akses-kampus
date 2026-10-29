import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findShortestPath,
  turnDirection,
  buildSteps,
  type GraphNode,
  type GraphEdge,
  segmentLength,
} from "../src/lib/routing";
import * as seed from "../src/db/seed-data";

const n = (id: number, x: number, y: number): GraphNode => ({
  id,
  x,
  y,
  verificationStatus: "unverified",
});
const e = (id: number, a: number, b: number, cost: number, isActive = true): GraphEdge => ({
  id,
  fromNodeId: a,
  toNodeId: b,
  cost,
  isActive,
  verificationStatus: "unverified",
});

// 1 —— 2 —— 3
// |          |
// 4 ———————— 5      6 (terpisah)
const nodes = [n(1, 0, 0), n(2, 1, 0), n(3, 2, 0), n(4, 0, 1), n(5, 2, 1), n(6, 5, 5)];
const edges = [e(1, 1, 2, 1), e(2, 2, 3, 1), e(3, 1, 4, 1), e(4, 4, 5, 5), e(5, 3, 5, 1)];

test("memilih jalur dengan bobot total terkecil", () => {
  const r = findShortestPath(nodes, edges, 1, 5);
  assert.equal(r.found, true);
  if (r.found) {
    assert.deepEqual(r.nodeIds, [1, 2, 3, 5]);
    assert.deepEqual(r.edgeIds, [1, 2, 5]);
    assert.equal(r.cost, 3);
  }
});

test("edge tidak aktif tidak dipakai", () => {
  const withInactive = edges.map((x) => (x.id === 2 ? { ...x, isActive: false } : x));
  const r = findShortestPath(nodes, withInactive, 1, 5);
  assert.equal(r.found, true);
  if (r.found) assert.deepEqual(r.nodeIds, [1, 4, 5]);
});

test("mengembalikan found:false bila node tidak terhubung", () => {
  assert.deepEqual(findShortestPath(nodes, edges, 1, 6), { found: false });
});

test("mengembalikan found:false bila node tidak dikenal", () => {
  assert.deepEqual(findShortestPath(nodes, edges, 1, 99), { found: false });
});

test("edge dua arah", () => {
  const r = findShortestPath(nodes, edges, 5, 1);
  assert.equal(r.found, true);
  if (r.found) assert.deepEqual(r.nodeIds, [5, 3, 2, 1]);
});

test("titik awal sama dengan tujuan", () => {
  const r = findShortestPath(nodes, edges, 3, 3);
  assert.deepEqual(r, { found: true, nodeIds: [3], edgeIds: [], cost: 0 });
});

test("arah belok memakai sumbu y ke bawah", () => {
  // Berjalan ke kanan lalu ke bawah layar = belok kanan.
  assert.equal(turnDirection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }), "right");
  // Berjalan ke kanan lalu ke atas layar = belok kiri.
  assert.equal(turnDirection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }), "left");
  assert.equal(turnDirection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }), "straight");
});

test("instruksi teks diawali titik awal dan diakhiri tujuan", () => {
  const steps = buildSteps([n(1, 0, 0), n(2, 1, 0), n(3, 1, 1)], "Lobby", "LKC");
  assert.equal(steps[0], "Mulai dari Lobby.");
  assert.equal(steps.at(-1), "Tiba di LKC.");
  assert.ok(steps.includes("Belok kanan."));
});

// Graph lantai 1 dari seed-data.ts, dengan bobot yang sama seperti src/db/seed.ts.
function seedRoute(fromSlug: string, toSlug: string) {
  const idByCode = new Map(seed.nodes.map((node, i) => [node.code, i + 1]));
  const codeById = new Map([...idByCode].map(([code, id]) => [id, code]));
  const nodeByCode = new Map(seed.nodes.map((node) => [node.code, node]));
  const graphNodes = seed.nodes.map((node) => n(idByCode.get(node.code)!, node.x, node.y));
  const graphEdges = seed.edges.map(([a, b], i) =>
    e(i + 1, idByCode.get(a)!, idByCode.get(b)!, segmentLength(nodeByCode.get(a)!, nodeByCode.get(b)!)),
  );
  const entry = (slug: string) => idByCode.get(seed.locations.find((l) => l.slug === slug)!.entryNodeCode!)!;
  const r = findShortestPath(graphNodes, graphEdges, entry(fromSlug), entry(toSlug));
  assert.equal(r.found, true);
  return r.found ? r.nodeIds.map((id) => codeById.get(id)!) : [];
}

test("denah: lift dimasuki dari bukaan sisi timur lewat lorong samping LKC", () => {
  for (const from of ["lobby", "bca", "lab-restoran"]) {
    const path = seedRoute(from, "elevator");
    assert.deepEqual(path.slice(-2), ["J-ELV", "E-ELEV"], `${from} → elevator`);
    assert.ok(!path.includes("J-MID"), `${from} → elevator tidak memutar lewat aula barat`);
  }
});

test("denah: ATM BCA ke SRSC lewat lorong lift, tidak memutar lewat aula barat", () => {
  const path = seedRoute("atm-bca", "srsc");
  assert.ok(path.includes("J-ELV"));
  assert.ok(!path.includes("J-MID"));
});
