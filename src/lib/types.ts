/** Tipe data yang dikembalikan REST API, dipakai oleh komponen klien. */

export type VerificationStatus = "unverified" | "verified" | "outdated";
export type SourceType = "reference_map" | "field_verified" | "demo_simulation";

export type LocationDto = {
  id: number;
  floor_id: number;
  slug: string;
  name: string;
  short_name: string | null;
  aliases: string[];
  type: string;
  type_label: string;
  description: string | null;
  marker: { x: number; y: number };
  routable: boolean;
  route_note: string | null;
  verification_status: VerificationStatus;
  source_type: SourceType;
  needs_route_review: boolean;
  updated_at: string;
};

export type FloorDto = {
  id: number;
  number: number;
  name: string;
  building: { id: number; slug: string; name: string; campus: string | null };
  map: {
    asset: string | null;
    width: number;
    height: number;
    coordinate_system: string;
    source_label: string | null;
    source_note: string | null;
    verification_status: VerificationStatus;
  };
  stats: { locations: number; nodes: number; edges: number };
  updated_at: string;
};

export type GraphDto = {
  floor_id: number;
  nodes: {
    id: number;
    code: string;
    label: string | null;
    x: number;
    y: number;
    kind: string;
    verification_status: VerificationStatus;
  }[];
  edges: { id: number; from: number; to: number; cost: number; verification_status: VerificationStatus }[];
};

type Endpoint = { id: number; slug: string; name: string; marker: { x: number; y: number } };

export type RouteDto =
  | {
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
    }
  | { status: "route_unavailable"; reason: string; from: Endpoint; to: Endpoint; waypoints: [] };

export type ApiErrorBody = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

/** Fetch JSON dengan error yang mudah dibaca. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((body as ApiErrorBody | null)?.error?.message ?? `Permintaan gagal (${res.status}).`);
    (err as Error & { status?: number; details?: unknown }).status = res.status;
    (err as Error & { details?: unknown }).details = (body as ApiErrorBody | null)?.error?.details;
    throw err;
  }
  return body as T;
}
