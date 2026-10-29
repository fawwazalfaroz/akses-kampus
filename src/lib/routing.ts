/**
 * Layanan pencarian rute berbasis graph.
 *
 * Denah dimodelkan sebagai graph tak berarah: titik simpang/koridor/pintu = node,
 * segmen koridor yang benar-benar terhubung = edge. Rute dicari dengan algoritma
 * Dijkstra (bobot non-negatif). Fungsi di file ini murni (tanpa database)
 * supaya mudah diuji.
 */

export type GraphNode = {
  id: number;
  x: number;
  y: number;
  label?: string | null;
  verificationStatus: "unverified" | "verified" | "outdated";
};

export type GraphEdge = {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  cost: number;
  isActive: boolean;
  verificationStatus: "unverified" | "verified" | "outdated";
};

export type PathResult =
  | { found: true; nodeIds: number[]; edgeIds: number[]; cost: number }
  | { found: false };

/** Panjang segmen dalam satuan peta relatif (0–1 terhadap kanvas). */
export function segmentLength(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Min-heap sederhana untuk antrean prioritas Dijkstra. */
class MinHeap {
  private items: { id: number; dist: number }[] = [];

  get size() {
    return this.items.length;
  }

  push(item: { id: number; dist: number }) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].dist <= this.items[i].dist) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.items[l].dist < this.items[smallest].dist) smallest = l;
        if (r < this.items.length && this.items[r].dist < this.items[smallest].dist) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * Mencari jalur terpendek antara dua node.
 * Hanya edge aktif yang dipakai; edge dengan bobot negatif/tidak valid diabaikan.
 */
export function findShortestPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: number,
  goalId: number,
): PathResult {
  const nodeIds = new Set(nodes.map((n) => n.id));
  if (!nodeIds.has(startId) || !nodeIds.has(goalId)) return { found: false };
  if (startId === goalId) return { found: true, nodeIds: [startId], edgeIds: [], cost: 0 };

  const adjacency = new Map<number, { to: number; cost: number; edgeId: number }[]>();
  for (const e of edges) {
    if (!e.isActive || !Number.isFinite(e.cost) || e.cost < 0) continue;
    if (!nodeIds.has(e.fromNodeId) || !nodeIds.has(e.toNodeId)) continue;
    // Koridor dianggap dua arah.
    if (!adjacency.has(e.fromNodeId)) adjacency.set(e.fromNodeId, []);
    if (!adjacency.has(e.toNodeId)) adjacency.set(e.toNodeId, []);
    adjacency.get(e.fromNodeId)!.push({ to: e.toNodeId, cost: e.cost, edgeId: e.id });
    adjacency.get(e.toNodeId)!.push({ to: e.fromNodeId, cost: e.cost, edgeId: e.id });
  }

  const dist = new Map<number, number>([[startId, 0]]);
  const prev = new Map<number, { node: number; edgeId: number }>();
  const visited = new Set<number>();
  const heap = new MinHeap();
  heap.push({ id: startId, dist: 0 });

  while (heap.size > 0) {
    const { id, dist: d } = heap.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === goalId) break;
    for (const next of adjacency.get(id) ?? []) {
      const candidate = d + next.cost;
      if (candidate < (dist.get(next.to) ?? Infinity)) {
        dist.set(next.to, candidate);
        prev.set(next.to, { node: id, edgeId: next.edgeId });
        heap.push({ id: next.to, dist: candidate });
      }
    }
  }

  if (!dist.has(goalId)) return { found: false };

  const pathNodes: number[] = [goalId];
  const pathEdges: number[] = [];
  let cursor = goalId;
  while (cursor !== startId) {
    const step = prev.get(cursor)!;
    pathEdges.unshift(step.edgeId);
    pathNodes.unshift(step.node);
    cursor = step.node;
  }
  return { found: true, nodeIds: pathNodes, edgeIds: pathEdges, cost: dist.get(goalId)! };
}

export type Turn = "straight" | "left" | "right" | "back";

/**
 * Menentukan arah belok di titik b ketika berjalan a → b → c.
 * Sumbu y pada denah mengarah ke bawah, sehingga tanda cross product dibalik.
 */
export function turnDirection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): Turn {
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (len === 0) return "straight";
  const cross = (v1.x * v2.y - v1.y * v2.x) / len;
  const dot = (v1.x * v2.x + v1.y * v2.y) / len;
  if (dot < -0.85) return "back";
  if (Math.abs(cross) < 0.5 && dot > 0) return "straight"; // belokan < ~30° dianggap lurus
  // Pada layar (y ke bawah), cross > 0 berarti berbelok searah jarum jam = kanan.
  return cross > 0 ? "right" : "left";
}

/** Membuat instruksi teks sederhana dari urutan node. */
export function buildSteps(
  path: GraphNode[],
  fromName: string,
  toName: string,
): string[] {
  const steps: string[] = [`Mulai dari ${fromName}.`];
  if (path.length < 2) {
    steps.push(`Anda sudah berada di ${toName}.`);
    return steps;
  }
  let pendingStraight = false;
  for (let i = 1; i < path.length - 1; i++) {
    const turn = turnDirection(path[i - 1], path[i], path[i + 1]);
    const where = path[i].label ? ` di ${path[i].label}` : "";
    if (turn === "straight") {
      pendingStraight = true;
      continue;
    }
    if (pendingStraight) {
      steps.push("Jalan lurus mengikuti koridor.");
      pendingStraight = false;
    }
    if (turn === "left") steps.push(`Belok kiri${where}.`);
    else if (turn === "right") steps.push(`Belok kanan${where}.`);
    else steps.push(`Putar balik${where}.`);
  }
  if (pendingStraight || steps.length === 1) steps.push("Jalan lurus mengikuti koridor.");
  steps.push(`Tiba di ${toName}.`);
  return steps;
}
