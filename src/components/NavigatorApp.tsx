"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, type FloorDto, type GraphDto, type LocationDto, type RouteDto } from "@/lib/types";
import { FloorMap } from "./FloorMap";
import { ReportDialog } from "./ReportDialog";
import { RouteStatusBadge, SOURCE_LABELS, StatusBadge } from "./StatusBadge";
import { AlertIcon, CloseIcon, FlagIcon, PinIcon, SearchIcon, SwapIcon, TypeIcon } from "./icons";

const FLOOR_ID = 1;

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; floor: FloorDto; locations: LocationDto[]; graph: GraphDto };

export function NavigatorApp() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [matches, setMatches] = useState<LocationDto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [route, setRoute] = useState<RouteDto | null>(null);
  const [routeKey, setRouteKey] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ x: number; y: number; key: number } | null>(null);
  const [reportFor, setReportFor] = useState<LocationDto | null | undefined>(undefined);
  const routeRef = useRef<HTMLElement>(null);

  const [loadAttempt, setLoadAttempt] = useState(0);

  // Muat data awal dari REST API + pulihkan state dari URL (?from=&to=&lokasi=) agar tautan bisa dibagikan.
  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ data: FloorDto }>(`/api/floors/${FLOOR_ID}`),
      apiFetch<{ data: LocationDto[] }>(`/api/locations?floor_id=${FLOOR_ID}`),
      apiFetch<{ data: GraphDto }>(`/api/floors/${FLOOR_ID}/graph`),
    ])
      .then(([floor, locs, graph]) => {
        if (!active) return;
        setLoad({ kind: "ready", floor: floor.data, locations: locs.data, graph: graph.data });
        const params = new URLSearchParams(window.location.search);
        const bySlug = (slug: string | null) => locs.data.find((l) => l.slug === slug) ?? null;
        const f = bySlug(params.get("from"));
        const t = bySlug(params.get("to"));
        const sel = bySlug(params.get("lokasi"));
        if (f) setFromId(f.id);
        if (t) setToId(t.id);
        if (sel) setSelectedId(sel.id);
        if (f && t) void findRouteRef.current(f, t);
      })
      .catch((err) => active && setLoad({ kind: "error", message: (err as Error).message }));
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const locations = useMemo(() => (load.kind === "ready" ? load.locations : []), [load]);
  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // Pencarian lewat REST API (debounce 200 ms).
  useEffect(() => {
    if (load.kind !== "ready") return;
    const q = query.trim();
    if (!q && !typeFilter) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ floor_id: String(FLOOR_ID) });
        if (q) params.set("q", q.slice(0, 80));
        if (typeFilter) params.set("type", typeFilter);
        const res = await apiFetch<{ data: LocationDto[] }>(`/api/locations?${params}`, { signal: ctrl.signal });
        setMatches(res.data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, typeFilter, load.kind]);

  const syncUrl = useCallback(
    (next: { from?: number | null; to?: number | null; lokasi?: number | null }) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, id] of Object.entries(next)) {
        if (id === undefined) continue;
        const slug = id ? byId.get(id)?.slug : null;
        if (slug) params.set(key, slug);
        else params.delete(key);
      }
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [byId],
  );

  const selectLocation = useCallback(
    (id: number, { focusMap = true } = {}) => {
      setSelectedId(id);
      syncUrl({ lokasi: id });
      const loc = byId.get(id);
      if (loc && focusMap) setFocus({ x: loc.marker.x, y: loc.marker.y, key: Date.now() });
    },
    [byId, syncUrl],
  );

  const findRouteRef = useRef(findRoute);
  useEffect(() => {
    findRouteRef.current = findRoute;
  });

  async function findRoute(from: LocationDto | undefined | null, to: LocationDto | undefined | null) {
    if (!from || !to) {
      setRouteError("Pilih titik awal dan tujuan terlebih dahulu.");
      return;
    }
    if (from.id === to.id) {
      setRouteError("Titik awal dan tujuan sama. Pilih tujuan lain.");
      return;
    }
    setRouteError(null);
    setRouteLoading(true);
    try {
      const res = await apiFetch<RouteDto>(
        `/api/routes?from=${encodeURIComponent(from.slug)}&to=${encodeURIComponent(to.slug)}`,
      );
      setRoute(res);
      setRouteKey((k) => k + 1);
      requestAnimationFrame(() => {
        // Ponsel: kembali ke peta agar garis rute terlihat. Desktop: tampilkan instruksi di panel.
        if (window.matchMedia("(max-width: 1023px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
        else routeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (err) {
      setRoute(null);
      setRouteError((err as Error).message);
    } finally {
      setRouteLoading(false);
    }
  }

  function setEndpoint(which: "from" | "to", id: number | null) {
    if (which === "from") setFromId(id);
    else setToId(id);
    setRoute(null);
    syncUrl({ [which]: id });
  }

  function swap() {
    setFromId(toId);
    setToId(fromId);
    setRoute(null);
    syncUrl({ from: toId, to: fromId });
  }

  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of locations) seen.set(l.type, l.type_label);
    return [...seen.entries()];
  }, [locations]);

  // Hasil pencarian hanya berlaku saat ada kata kunci atau filter aktif.
  const filtering = query.trim() !== "" || typeFilter !== null;
  const activeMatches = filtering ? matches : null;
  const matchIds = useMemo(() => (activeMatches ? new Set(activeMatches.map((m) => m.id)) : null), [activeMatches]);
  const listed = activeMatches ?? locations;

  if (load.kind === "loading") {
    return (
      <Shell onReport={() => {}}>
        <div className="grid flex-1 place-items-center p-10 text-ink-soft" role="status">
          Memuat denah dan data lokasi…
        </div>
      </Shell>
    );
  }

  if (load.kind === "error") {
    return (
      <Shell onReport={() => {}}>
        <div className="mx-auto mt-16 max-w-md px-6 text-center" role="alert">
          <p className="text-lg font-bold">Data belum bisa dimuat</p>
          <p className="mt-2 text-ink-soft">{load.message} Periksa koneksi internet, lalu coba lagi.</p>
          <button
            onClick={() => {
              setLoad({ kind: "loading" });
              setLoadAttempt((n) => n + 1);
            }}
            className="mt-6 rounded-lg bg-ink px-5 py-2.5 font-semibold text-white hover:bg-ink/90"
          >
            Muat ulang
          </button>
        </div>
      </Shell>
    );
  }

  const fromLoc = fromId ? byId.get(fromId) : undefined;
  const toLoc = toId ? byId.get(toId) : undefined;

  return (
    <Shell onReport={() => setReportFor(null)}>
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* Peta */}
        <section
          aria-label="Denah"
          className="relative order-1 h-[58svh] min-h-[340px] border-b border-line lg:order-2 lg:h-auto lg:flex-1 lg:border-b-0"
        >
          <FloorMap
            floor={load.floor}
            locations={locations}
            graph={load.graph}
            selectedId={selectedId}
            fromId={fromId}
            toId={toId}
            matchIds={matchIds}
            route={route}
            routeKey={routeKey}
            focus={focus}
            onSelect={(id) => selectLocation(id, { focusMap: false })}
          />
          {selected && (
            <LocationCard
              loc={selected}
              isFrom={selected.id === fromId}
              isTo={selected.id === toId}
              onClose={() => {
                setSelectedId(null);
                syncUrl({ lokasi: null });
              }}
              onSetFrom={() => {
                setEndpoint("from", selected.id);
                if (toLoc && toLoc.id !== selected.id) void findRoute(selected, toLoc);
              }}
              onSetTo={() => {
                setEndpoint("to", selected.id);
                if (fromLoc && fromLoc.id !== selected.id) void findRoute(fromLoc, selected);
              }}
              onReport={() => setReportFor(selected)}
            />
          )}
        </section>

        {/* Panel kiri */}
        <aside className="order-2 flex w-full flex-col bg-raised lg:order-1 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-line">
          <section aria-labelledby="search-title" className="order-2 border-b border-line px-5 py-5 lg:order-1">
            <h2 id="search-title" className="text-base font-bold">
              Cari ruangan atau fasilitas
            </h2>
            <div className="relative mt-3">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={80}
                placeholder="Contoh: LKC, perpustakaan, BCA"
                aria-label="Kata kunci ruangan atau fasilitas"
                className="w-full rounded-lg border border-line bg-paper py-2.5 pl-9 pr-3 placeholder:text-ink-faint focus:border-ink focus:bg-raised"
              />
            </div>
            <div
              className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:thin]"
              role="group"
              aria-label="Filter jenis lokasi"
            >
              {typeOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={typeFilter === value}
                  onClick={() => setTypeFilter((t) => (t === value ? null : value))}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    typeFilter === value ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:border-ink-faint"
                  }`}
                >
                  <TypeIcon type={value} className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-ink-soft" aria-live="polite">
              {searching
                ? "Mencari…"
                : activeMatches
                  ? activeMatches.length
                    ? `${activeMatches.length} lokasi cocok`
                    : "Tidak ada lokasi yang cocok. Coba kata lain, atau laporkan ruang yang belum ada."
                  : `${locations.length} lokasi di ${load.floor.name}`}
            </p>
            <ul className="-mx-2 mt-2 lg:max-h-[34vh] lg:overflow-y-auto">
              {listed.map((loc) => (
                <li key={loc.id}>
                  <button
                    type="button"
                    onClick={() => selectLocation(loc.id)}
                    aria-current={loc.id === selectedId ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-paper ${
                      loc.id === selectedId ? "bg-paper" : ""
                    }`}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-white">
                      <TypeIcon type={loc.type} className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {loc.name}
                        {loc.short_name && !loc.name.startsWith(loc.short_name) && (
                          <span className="font-normal text-ink-soft"> ({loc.short_name})</span>
                        )}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {loc.type_label}
                        {!loc.routable && ", rute belum tersedia"}
                      </span>
                    </span>
                    <span
                      className={`size-2 shrink-0 rounded-full ${
                        loc.verification_status === "verified"
                          ? "bg-verified"
                          : loc.verification_status === "outdated"
                            ? "bg-outdated"
                            : "bg-unverified"
                      }`}
                      title={loc.verification_status === "verified" ? "Terverifikasi" : "Belum terverifikasi"}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section
            ref={routeRef}
            aria-labelledby="route-title"
            className="order-1 border-b border-line px-5 py-5 lg:order-2 lg:border-b-0"
          >
            <h2 id="route-title" className="text-base font-bold">
              Cari rute
            </h2>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void findRoute(fromLoc, toLoc);
              }}
            >
              <div className="relative grid grid-cols-[minmax(0,1fr)] gap-2 pr-11">
                <EndpointSelect
                  id="from"
                  label="Dari"
                  dotClass="bg-go"
                  value={fromId}
                  locations={locations}
                  onChange={(id) => setEndpoint("from", id)}
                />
                <EndpointSelect
                  id="to"
                  label="Ke"
                  dotClass="bg-ink ring-2 ring-signal"
                  value={toId}
                  locations={locations}
                  onChange={(id) => setEndpoint("to", id)}
                />
                <button
                  type="button"
                  onClick={swap}
                  aria-label="Tukar titik awal dan tujuan"
                  title="Tukar"
                  className="absolute right-0 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg border border-line text-ink hover:bg-paper"
                >
                  <SwapIcon />
                </button>
              </div>
              <button
                type="submit"
                disabled={routeLoading}
                className="mt-3 w-full rounded-lg bg-go px-4 py-2.5 font-semibold text-white hover:bg-go-strong disabled:opacity-60"
              >
                {routeLoading ? "Mencari rute…" : "Cari rute"}
              </button>
            </form>

            <div aria-live="polite">
              {routeError && (
                <p role="alert" className="mt-3 rounded-lg bg-outdated-bg px-3 py-2 text-sm text-outdated">
                  {routeError}
                </p>
              )}
              {route && <RouteResult route={route} />}
            </div>
          </section>

          <footer className="order-3 border-t border-line px-5 py-4 text-xs leading-relaxed text-ink-soft">
            Nama lokasi diambil dari denah referensi dan belum seluruhnya diverifikasi di lapangan. Rute berlabel
            simulasi hanya gambaran umum. Temukan yang keliru?{" "}
            <button onClick={() => setReportFor(null)} className="font-semibold text-ink underline underline-offset-2">
              Laporkan
            </button>
            .
          </footer>
        </aside>
      </div>

      <ReportDialog
        open={reportFor !== undefined}
        location={reportFor ?? null}
        onClose={() => setReportFor(undefined)}
      />
    </Shell>
  );
}

function Shell({ children, onReport }: { children: React.ReactNode; onReport: () => void }) {
  return (
    <div className="flex min-h-svh flex-col lg:h-svh">
      <header className="flex items-center justify-between gap-3 border-b border-ink/10 bg-ink px-4 py-3 text-white sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold leading-tight tracking-tight">AksesKampus</p>
            <p className="truncate text-xs text-white/70">BINUS Anggrek, Lantai 1</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <button onClick={onReport} className="rounded-lg px-3 py-2 font-semibold text-white/90 hover:bg-white/10">
            Lapor<span className="hidden sm:inline">kan ruang</span>
          </button>
          <Link href="/admin" className="rounded-lg px-3 py-2 font-semibold text-white/90 hover:bg-white/10">
            Admin
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 flex-col lg:min-h-0">{children}</main>
    </div>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--signal)" />
      <path d="M9 23V12.5L16 8l7 4.5V23" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M12.5 23v-5.5h7" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 14.5l2.5 3-2.5 3" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EndpointSelect({
  id,
  label,
  dotClass,
  value,
  locations,
  onChange,
}: {
  id: string;
  label: string;
  dotClass: string;
  value: number | null;
  locations: LocationDto[];
  onChange: (id: number | null) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-paper px-3 focus-within:border-ink focus-within:bg-raised">
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${dotClass}`} />
      <label htmlFor={id} className="w-8 shrink-0 text-sm font-semibold text-ink-soft">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="min-w-0 flex-1 bg-transparent py-2.5 font-semibold focus:outline-none"
      >
        <option value="">Pilih lokasi</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.short_name && !l.name.startsWith(l.short_name) ? `${l.short_name} (${l.name})` : l.name}
            {!l.routable ? " — rute belum tersedia" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function RouteResult({ route }: { route: RouteDto }) {
  if (route.status === "route_unavailable") {
    return (
      <div className="mt-4 rounded-xl border border-line bg-paper p-4">
        <p className="flex items-center gap-2 font-bold">
          <AlertIcon className="size-4 text-unverified" />
          Rute belum tersedia
        </p>
        <p className="mt-1.5 text-sm text-ink-soft">{route.reason}</p>
        <p className="mt-2 text-xs text-ink-faint">
          Kami tidak menggambar garis tebakan. Rute muncul setelah koridornya dipetakan.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <RouteStatusBadge status={route.route_status} />
        <span className="text-xs text-ink-soft">
          {route.waypoints.length} titik jalur, {route.steps.length - 2} instruksi
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{route.notice}</p>
      <ol className="mt-3 space-y-0">
        {route.steps.map((step, i) => {
          const first = i === 0;
          const last = i === route.steps.length - 1;
          return (
            <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
              {!last && <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-0.5 bg-line" />}
              <span
                aria-hidden="true"
                className={`relative grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  first ? "bg-go text-white" : last ? "bg-ink text-signal" : "border border-line bg-raised text-ink"
                }`}
              >
                {first ? <PinIcon className="size-3.5" /> : last ? <FlagIcon className="size-3.5" /> : i}
              </span>
              <span className={`pt-0.5 text-sm ${first || last ? "font-semibold" : ""}`}>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LocationCard({
  loc,
  isFrom,
  isTo,
  onClose,
  onSetFrom,
  onSetTo,
  onReport,
}: {
  loc: LocationDto;
  isFrom: boolean;
  isTo: boolean;
  onClose: () => void;
  onSetFrom: () => void;
  onSetTo: () => void;
  onReport: () => void;
}) {
  const updated = new Date(loc.updated_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div
      role="region"
      aria-label={`Detail ${loc.name}`}
      className="absolute inset-x-3 bottom-3 z-10 max-h-[70%] overflow-y-auto rounded-xl border border-line bg-raised p-4 shadow-lg sm:inset-x-auto sm:left-3 sm:top-3 sm:bottom-auto sm:w-80"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white">
          <TypeIcon type={loc.type} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-snug">{loc.name}</h3>
          <p className="text-sm text-ink-soft">
            {loc.type_label}
            {loc.short_name && loc.short_name !== loc.name ? `, disebut juga ${loc.short_name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="-mr-1 -mt-1 grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-paper"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={loc.verification_status} />
        <span className="text-xs text-ink-soft">Sumber: {SOURCE_LABELS[loc.source_type]}</span>
      </div>
      {loc.description && <p className="mt-3 text-sm leading-relaxed">{loc.description}</p>}
      {loc.needs_route_review && (
        <p className="mt-3 rounded-lg bg-outdated-bg px-3 py-2 text-sm text-outdated">
          Ada perubahan yang disetujui pada lokasi ini. Rute ke sini perlu diverifikasi ulang.
        </p>
      )}
      {!loc.routable && (
        <p className="mt-3 rounded-lg bg-unverified-bg px-3 py-2 text-sm text-unverified">
          {loc.route_note ?? "Titik masuk belum dipetakan, jadi rute ke lokasi ini belum tersedia."}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-faint">Diperbarui {updated}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSetFrom}
          disabled={isFrom}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper disabled:opacity-50"
        >
          {isFrom ? "Titik awal" : "Mulai dari sini"}
        </button>
        <button
          type="button"
          onClick={onSetTo}
          disabled={isTo}
          className="rounded-lg bg-go px-3 py-2 text-sm font-semibold text-white hover:bg-go-strong disabled:opacity-50"
        >
          {isTo ? "Tujuan" : "Rute ke sini"}
        </button>
      </div>
      <button
        type="button"
        onClick={onReport}
        className="mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft underline-offset-2 hover:underline"
      >
        Laporkan perubahan
      </button>
    </div>
  );
}
