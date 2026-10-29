"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FloorDto, GraphDto, LocationDto, RouteDto } from "@/lib/types";
import { TYPE_GLYPHS, PlusIcon, MinusIcon, ResetIcon, LayersIcon } from "./icons";
import { SOURCE_LABELS } from "./StatusBadge";

type View = { x: number; y: number; w: number; h: number };

type Props = {
  floor: FloorDto;
  locations: LocationDto[];
  graph: GraphDto | null;
  selectedId: number | null;
  fromId: number | null;
  toId: number | null;
  matchIds: Set<number> | null;
  route: RouteDto | null;
  routeKey: number;
  focus: { x: number; y: number; key: number } | null;
  onSelect: (id: number) => void;
};

const STATUS_RING: Record<string, { stroke: string; dash?: string }> = {
  verified: { stroke: "var(--status-verified)" },
  unverified: { stroke: "var(--status-unverified)", dash: "3 2.5" },
  outdated: { stroke: "var(--status-outdated)" },
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function FloorMap({
  floor,
  locations,
  graph,
  selectedId,
  fromId,
  toId,
  matchIds,
  route,
  routeKey,
  focus,
  onSelect,
}: Props) {
  const W = floor.map.width;
  const H = floor.map.height;
  const [size, setSize] = useState({ w: 800, h: 500 });
  // Tampilan awal: seluruh denah; pada layar sempit (ponsel) isi tinggi kanvas agar tidak terlalu kecil.
  const home = useMemo<View>(() => {
    const containerAspect = size.w / size.h;
    if (containerAspect >= (W / H) * 0.8) return { x: 0, y: 0, w: W, h: H };
    const w = Math.max(H * containerAspect, W * 0.45);
    const h = w / containerAspect;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }, [W, H, size.w, size.h]);
  // null = pengguna belum menggeser/zoom, sehingga tampilan mengikuti `home`.
  const [userView, setUserView] = useState<View | null>(null);
  const view = userView ?? home;
  // Komponen ini hanya dirender di klien (setelah data API dimuat), jadi aman membaca window.
  const [legendOpen, setLegendOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  const [showGraph, setShowGraph] = useState(!floor.map.asset);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  });
  const animRef = useRef<number | null>(null);
  const setView = useCallback(
    (next: View | ((v: View) => View)) =>
      setUserView((prev) => (typeof next === "function" ? next(prev ?? viewRef.current) : next)),
    [],
  );

  // Satuan SVG per piksel layar, agar penanda & garis berukuran tetap saat di-zoom.
  const unit = Math.max(view.w / size.w, view.h / size.h);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width || 1, h: entry.contentRect.height || 1 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampView = useCallback(
    (v: View): View => {
      const minW = W / 6;
      const maxW = W * 1.25;
      const w = Math.min(maxW, Math.max(minW, v.w));
      const h = (w / v.w) * v.h;
      const x = Math.min(W - w * 0.25, Math.max(-w * 0.75, v.x));
      const y = Math.min(H - h * 0.25, Math.max(-h * 0.75, v.y));
      return { x, y, w, h };
    },
    [W, H],
  );

  const animateTo = useCallback(
    (target: View) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const t = clampView(target);
      if (prefersReducedMotion()) {
        setView(t);
        return;
      }
      const start = viewRef.current;
      const t0 = performance.now();
      const dur = 420;
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setView({
          x: start.x + (t.x - start.x) * e,
          y: start.y + (t.y - start.y) * e,
          w: start.w + (t.w - start.w) * e,
          h: start.h + (t.h - start.h) * e,
        });
        if (p < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    },
    [clampView, setView],
  );

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const v = viewRef.current;
      const px = cx ?? v.x + v.w / 2;
      const py = cy ?? v.y + v.h / 2;
      const next = clampView({
        w: v.w * factor,
        h: v.h * factor,
        x: px - (px - v.x) * factor,
        y: py - (py - v.y) * factor,
      });
      setView(next);
    },
    [clampView, setView],
  );

  // Fokus ke lokasi yang dipilih dari pencarian.
  useEffect(() => {
    if (!focus) return;
    const w = Math.min(viewRef.current.w, W / 2);
    const h = (w / W) * H;
    animateTo({ x: focus.x * W - w / 2, y: focus.y * H - h / 2, w, h });
  }, [focus, W, H, animateTo]);

  // Saat rute baru muncul, tampilkan seluruh rute dalam layar.
  useEffect(() => {
    if (!route || route.status !== "ok") return;
    const pts = [route.from.marker, ...route.waypoints, route.to.marker];
    const xs = pts.map((p) => p.x * W);
    const ys = pts.map((p) => p.y * H);
    const pad = Math.max(W, H) * 0.08;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    let w = maxX - minX;
    let h = maxY - minY;
    const aspect = W / H;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    animateTo({ x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Zoom dengan roda mouse (listener non-pasif agar halaman tidak ikut tergulir).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvgPoint(svg, e.clientX, e.clientY);
      zoomAt(Math.exp(e.deltaY * 0.0015), p.x, p.y);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Geser (drag) dan cubit (pinch) memakai Pointer Events.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragMoved = useRef(0);
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved.current = 0;
    if (pointers.current.size === 1 && (e.target as Element).closest(".map-marker")) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const svg = svgRef.current!;
    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      dragMoved.current += Math.abs(dx) + Math.abs(dy);
      if (dragMoved.current < 4) return;
      const u = Math.max(viewRef.current.w / size.w, viewRef.current.h / size.h);
      setView((v) => clampView({ ...v, x: v.x - dx * u, y: v.y - dy * u }));
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.entries()];
      const other = a[0] === e.pointerId ? b[1] : a[1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0 && after > 0) {
        const mid = toSvgPoint(svg, (e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
        zoomAt(before / after, mid.x, mid.y);
      }
      dragMoved.current += 10;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const nodeById = useMemo(() => new Map(graph?.nodes.map((n) => [n.id, n]) ?? []), [graph]);

  const routePoints = route && route.status === "ok" ? route.waypoints.map((p) => [p.x * W, p.y * H]) : [];
  const routeLength = routePoints.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - routePoints[i - 1][0], p[1] - routePoints[i - 1][1])),
    0,
  );
  const routeD = routePoints.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");

  const r = 10 * unit; // radius penanda dalam piksel layar
  const fontSize = 11.5 * unit;
  // Saat denah diperkecil, label lokasi pendukung (lift, eskalator, toilet) disembunyikan agar tidak bertumpuk.
  const zoomedIn = view.w < W * 0.62;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-paper select-none">
      <svg
        ref={svgRef}
        role="application"
        aria-label={`Denah ${floor.name} ${floor.building.name}. Geser untuk berpindah, gunakan tombol plus dan minus untuk memperbesar.`}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <pattern id="grid-fine" width={W / 80} height={W / 80} patternUnits="userSpaceOnUse">
            <path d={`M ${W / 80} 0 L 0 0 0 ${W / 80}`} fill="none" stroke="var(--grid)" strokeWidth={unit * 0.8} />
          </pattern>
          <pattern id="grid-major" width={W / 16} height={W / 16} patternUnits="userSpaceOnUse">
            <rect width={W / 16} height={W / 16} fill="url(#grid-fine)" />
            <path d={`M ${W / 16} 0 L 0 0 0 ${W / 16}`} fill="none" stroke="var(--grid-strong)" strokeWidth={unit} />
          </pattern>
        </defs>

        {/* Kertas gambar */}
        <rect x={0} y={0} width={W} height={H} fill="var(--paper-raised)" />
        <rect x={0} y={0} width={W} height={H} fill="url(#grid-major)" />
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--ink)" strokeWidth={unit * 1.5} />

        {floor.map.asset ? (
          // Denah referensi sebagai base layer; geometri tidak diubah.
          <image href={floor.map.asset} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />
        ) : (
          <g aria-hidden="true">
            <text
              x={W / 2}
              y={H * 0.1}
              textAnchor="middle"
              fontSize={W * 0.018}
              fontWeight={700}
              fill="var(--ink-faint)"
            >
              Denah referensi belum dipasang
            </text>
            <text x={W / 2} y={H * 0.1 + W * 0.024} textAnchor="middle" fontSize={W * 0.012} fill="var(--ink-faint)">
              Koridor dan titik di bawah ini adalah data simulasi, bukan gambar denah asli.
            </text>
          </g>
        )}

        {/* Jaringan jalur (edge graph) */}
        {showGraph && graph && (
          <g aria-hidden="true">
            {graph.edges.map((e) => {
              const a = nodeById.get(e.from);
              const b = nodeById.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={e.id}
                  x1={a.x * W}
                  y1={a.y * H}
                  x2={b.x * W}
                  y2={b.y * H}
                  stroke={e.verification_status === "outdated" ? "var(--status-outdated-bg)" : "#e6ecea"}
                  strokeWidth={unit * 22}
                  strokeLinecap="round"
                />
              );
            })}
            {graph.edges.map((e) => {
              const a = nodeById.get(e.from);
              const b = nodeById.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={`c${e.id}`}
                  x1={a.x * W}
                  y1={a.y * H}
                  x2={b.x * W}
                  y2={b.y * H}
                  stroke="var(--ink-faint)"
                  strokeWidth={unit * 1}
                  strokeDasharray={`${unit * 4} ${unit * 4}`}
                />
              );
            })}
            {graph.nodes.map((n) => (
              <circle key={n.id} cx={n.x * W} cy={n.y * H} r={unit * 2.5} fill="var(--ink-faint)" />
            ))}
          </g>
        )}

        {/* Garis rute */}
        {route && route.status === "ok" && routePoints.length > 0 && (
          <g key={routeKey} aria-hidden="true" style={{ ["--route-length" as string]: routeLength }}>
            {/* Penghubung penanda ↔ titik masuk */}
            {[
              [route.from.marker, route.waypoints[0]],
              [route.to.marker, route.waypoints[route.waypoints.length - 1]],
            ].map(([m, wpt], i) => (
              <line
                key={i}
                x1={m.x * W}
                y1={m.y * H}
                x2={wpt.x * W}
                y2={wpt.y * H}
                stroke="var(--ink)"
                strokeWidth={unit * 2}
                strokeDasharray={`${unit * 2} ${unit * 4}`}
                strokeLinecap="round"
              />
            ))}
            <path
              d={routeD}
              className="route-reveal"
              fill="none"
              stroke="var(--ink)"
              strokeWidth={unit * 11}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={routeD}
              className="route-reveal"
              fill="none"
              stroke="var(--signal)"
              strokeWidth={unit * 6.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {route.route_status !== "verified" && (
              // Pola garis putus-putus = data simulasi / perlu dicek (tidak hanya mengandalkan warna).
              <path
                d={routeD}
                fill="none"
                stroke={route.route_status === "needs_review" ? "var(--status-outdated)" : "var(--ink)"}
                strokeWidth={unit * 6.5}
                strokeDasharray={`${unit * 7} ${unit * 9}`}
                style={{ animation: "none", opacity: 0.85 }}
              >
                {!prefersReducedMotion() && (
                  <animate attributeName="opacity" from="0" to="0.85" dur="0.3s" begin="0.8s" fill="freeze" />
                )}
              </path>
            )}
          </g>
        )}

        {/* Penanda lokasi */}
        {locations.map((loc) => {
          const cx = loc.marker.x * W;
          const cy = loc.marker.y * H;
          const isSelected = loc.id === selectedId;
          const isFrom = loc.id === fromId;
          const isTo = loc.id === toId;
          const dimmed = matchIds !== null && !matchIds.has(loc.id) && !isSelected && !isFrom && !isTo;
          const ring = STATUS_RING[loc.verification_status];
          const fill = isFrom ? "var(--go)" : "var(--ink)";
          const s = isSelected ? 1.18 : 1;
          const label = loc.short_name ?? loc.name;
          const tag = isFrom ? "Mulai" : isTo ? "Tujuan" : null;
          const minor = loc.type === "vertical_access" || loc.type === "toilet";
          const showLabel = !minor || zoomedIn || isSelected || isFrom || isTo;
          return (
            <g
              key={loc.id}
              className="map-marker cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${loc.name}, ${loc.type_label}${isFrom ? ", titik awal" : ""}${isTo ? ", tujuan" : ""}`}
              aria-pressed={isSelected}
              opacity={dimmed ? 0.3 : 1}
              onClick={() => {
                if (dragMoved.current < 6) onSelect(loc.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(loc.id);
                }
              }}
            >
              {(isSelected || isTo) && (
                <circle cx={cx} cy={cy} r={r * s} fill="var(--signal)" className="marker-pulse" />
              )}
              <circle cx={cx} cy={cy} r={r * s + unit * 3} fill="var(--paper-raised)" />
              <circle
                className="marker-ring"
                cx={cx}
                cy={cy}
                r={r * s + unit * 3}
                fill="none"
                stroke={isTo ? "var(--signal)" : ring.stroke}
                strokeWidth={unit * (isTo ? 4 : 2)}
                strokeDasharray={isTo || !ring.dash ? undefined : ring.dash.split(" ").map((d) => Number(d) * unit).join(" ")}
              />
              <circle cx={cx} cy={cy} r={r * s} fill={fill} />
              <g transform={`translate(${cx - 6.5 * unit * s} ${cy - 6.5 * unit * s}) scale(${(13 / 24) * unit * s})`}>
                <path
                  d={TYPE_GLYPHS[loc.type] ?? TYPE_GLYPHS.other}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              {showLabel && (
              <text
                x={cx}
                y={cy + r * s + unit * 4 + fontSize}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={isSelected ? 800 : 650}
                fill="var(--ink)"
                stroke="var(--paper-raised)"
                strokeWidth={unit * 4}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {label}
              </text>
              )}
              {tag && (
                <g transform={`translate(${cx} ${cy - r * s - unit * 12})`}>
                  <rect
                    x={-unit * 26}
                    y={-unit * 11}
                    width={unit * 52}
                    height={unit * 18}
                    rx={unit * 9}
                    fill={isFrom ? "var(--go)" : "var(--ink)"}
                  />
                  <text
                    x={0}
                    y={unit * 2.5}
                    textAnchor="middle"
                    fontSize={unit * 10.5}
                    fontWeight={700}
                    fill={isFrom ? "#fff" : "var(--signal)"}
                  >
                    {tag}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Kontrol zoom */}
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-line bg-raised shadow-sm">
        <MapButton label="Perbesar" onClick={() => zoomAt(0.7)}>
          <PlusIcon />
        </MapButton>
        <MapButton label="Perkecil" onClick={() => zoomAt(1 / 0.7)}>
          <MinusIcon />
        </MapButton>
        <MapButton
          label="Tampilkan seluruh denah"
          onClick={() => {
            animateTo(home);
          }}
        >
          <ResetIcon />
        </MapButton>
        <MapButton
          label={showGraph ? "Sembunyikan jaringan jalur" : "Tampilkan jaringan jalur"}
          pressed={showGraph}
          onClick={() => setShowGraph((v) => !v)}
        >
          <LayersIcon />
        </MapButton>
      </div>

      {/* Blok judul gambar: sumber dan status data */}
      <div className="pointer-events-none absolute bottom-3 right-3 hidden w-64 border-[1.5px] border-ink bg-raised/95 text-[11px] leading-snug text-ink sm:block">
        <div className="border-b border-ink px-2.5 py-1.5 text-[13px] font-bold">
          {floor.building.name}, {floor.name}
        </div>
        <dl className="grid grid-cols-[auto_1fr]">
          <dt className="border-b border-r border-line px-2.5 py-1 text-ink-soft">Sumber</dt>
          <dd className="border-b border-line px-2.5 py-1">
            {floor.map.asset ? floor.map.source_label ?? SOURCE_LABELS.reference_map : "Belum ada denah"}
          </dd>
          <dt className="border-b border-r border-line px-2.5 py-1 text-ink-soft">Status</dt>
          <dd className="border-b border-line px-2.5 py-1 font-semibold text-unverified">
            {floor.map.verification_status === "verified" ? "Terverifikasi" : "Belum terverifikasi"}
          </dd>
          <dt className="border-b border-r border-line px-2.5 py-1 text-ink-soft">Jalur</dt>
          <dd className="border-b border-line px-2.5 py-1">Simulasi, belum dicek di lokasi</dd>
          <dt className="border-r border-line px-2.5 py-1 text-ink-soft">Skala</dt>
          <dd className="px-2.5 py-1">Unit peta relatif, belum dikalibrasi</dd>
        </dl>
      </div>

      {/* Legenda */}
      <details
        className="absolute bottom-3 left-3 max-w-[16rem] rounded-lg border border-line bg-raised/95 text-xs text-ink shadow-sm open:pb-2"
        open={legendOpen}
        onToggle={(e) => setLegendOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer px-3 py-2 font-semibold">Legenda</summary>
        <ul className="space-y-1.5 px-3">
          <LegendRow swatch={<Dot fill="var(--go)" />} text="Titik awal" />
          <LegendRow swatch={<Dot fill="var(--ink)" ring="var(--signal)" />} text="Tujuan" />
          <LegendRow
            swatch={
              <svg width="28" height="10" aria-hidden="true">
                <line x1="2" y1="5" x2="26" y2="5" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round" />
                <line x1="2" y1="5" x2="26" y2="5" stroke="var(--signal)" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            }
            text="Rute terverifikasi"
          />
          <LegendRow
            swatch={
              <svg width="28" height="10" aria-hidden="true">
                <line x1="2" y1="5" x2="26" y2="5" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round" />
                <line x1="2" y1="5" x2="26" y2="5" stroke="var(--signal)" strokeWidth="4.5" strokeLinecap="round" />
                <line x1="2" y1="5" x2="26" y2="5" stroke="var(--ink)" strokeWidth="4.5" strokeDasharray="4 5" />
              </svg>
            }
            text="Rute simulasi (belum dicek)"
          />
          <LegendRow swatch={<Dot fill="var(--ink)" ring="var(--status-verified)" />} text="Data terverifikasi" />
          <LegendRow swatch={<Dot fill="var(--ink)" ring="var(--status-unverified)" dashed />} text="Data belum terverifikasi" />
        </ul>
      </details>
    </div>
  );
}

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function MapButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`grid size-10 place-items-center border-b border-line last:border-b-0 hover:bg-paper ${
        pressed ? "bg-ink text-white hover:bg-ink" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function LegendRow({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex w-7 justify-center">{swatch}</span>
      {text}
    </li>
  );
}

function Dot({ fill, ring, dashed }: { fill: string; ring?: string; dashed?: boolean }) {
  return (
    <svg width="18" height="18" aria-hidden="true">
      {ring && <circle cx="9" cy="9" r="7.5" fill="#fff" stroke={ring} strokeWidth="2" strokeDasharray={dashed ? "3 2" : undefined} />}
      <circle cx="9" cy="9" r={ring ? 5 : 6.5} fill={fill} />
    </svg>
  );
}
