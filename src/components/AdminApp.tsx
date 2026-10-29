"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, type LocationDto, type VerificationStatus } from "@/lib/types";
import { Logo } from "./NavigatorApp";
import { StatusBadge } from "./StatusBadge";

type Admin = { id: number; email: string; name: string };

type ReportItem = {
  id: number;
  category: "wrong_name" | "moved" | "facility_changed" | "other";
  category_label: string;
  description: string;
  suggested_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  location: {
    id: number;
    slug: string;
    name: string;
    short_name: string | null;
    description: string | null;
    type: string;
    verification_status: VerificationStatus;
  } | null;
};

const TYPE_OPTIONS = [
  ["entrance", "Pintu masuk / Lobby"],
  ["library", "Perpustakaan"],
  ["service", "Layanan mahasiswa"],
  ["retail", "Toko"],
  ["bank", "Bank / ATM"],
  ["vertical_access", "Akses vertikal"],
  ["office", "Kantor / Administrasi"],
  ["room", "Ruang"],
  ["toilet", "Toilet"],
  ["food", "Makanan & minuman"],
  ["other", "Lainnya"],
] as const;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm focus:border-ink";

export function AdminApp() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Admin }>("/api/admin/me")
      .then((r) => setAdmin(r.data))
      .catch(() => setAdmin(null))
      .finally(() => setChecking(false));
  }, []);

  async function logout() {
    await apiFetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setAdmin(null);
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="text-[17px] font-extrabold leading-tight">AksesKampus</p>
            <p className="text-xs text-white/70">Panel pengelola data</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-lg px-3 py-2 font-semibold text-white/90 hover:bg-white/10">
            Lihat peta
          </Link>
          {admin && (
            <button onClick={logout} className="rounded-lg px-3 py-2 font-semibold text-white/90 hover:bg-white/10">
              Keluar
            </button>
          )}
        </nav>
      </header>
      <main className="flex-1">
        {checking ? (
          <p className="p-10 text-center text-ink-soft" role="status">
            Memeriksa sesi…
          </p>
        ) : admin ? (
          <Dashboard admin={admin} onUnauthorized={() => setAdmin(null)} />
        ) : (
          <LoginForm onLogin={setAdmin} />
        )}
      </main>
    </div>
  );
}

function LoginForm({ onLogin }: { onLogin: (a: Admin) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const r = await apiFetch<{ data: Admin }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(r.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-16 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-raised p-6">
      <h1 className="text-xl font-bold">Masuk sebagai admin</h1>
      <p className="mt-1 text-sm text-ink-soft">Admin meninjau laporan pengguna dan memperbarui data lokasi.</p>
      <label className="mt-5 block text-sm font-semibold">
        Email
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-outdated-bg px-3 py-2 text-sm text-outdated">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="mt-5 w-full rounded-lg bg-ink px-4 py-2.5 font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
      >
        {sending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}

function Dashboard({ admin, onUnauthorized }: { admin: Admin; onUnauthorized: () => void }) {
  const [tab, setTab] = useState<"reports" | "locations">("reports");
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Halo, {admin.name}</h1>
          <p className="text-sm text-ink-soft">Perubahan yang kamu setujui langsung tampil di peta publik.</p>
        </div>
        <div className="flex rounded-lg border border-line bg-raised p-1" role="tablist" aria-label="Bagian panel">
          {(
            [
              ["reports", "Laporan"],
              ["locations", "Data lokasi"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                tab === value ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6">
        {tab === "reports" ? (
          <ReportsPanel onUnauthorized={onUnauthorized} />
        ) : (
          <LocationsPanel onUnauthorized={onUnauthorized} />
        )}
      </div>
    </div>
  );
}

function ReportsPanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch<{ data: ReportItem[] }>(`/api/admin/reports?status=${status}`);
      setItems(r.data);
    } catch (err) {
      if ((err as Error & { status?: number }).status === 401) onUnauthorized();
      setError((err as Error).message);
    }
  }, [status, onUnauthorized]);

  useEffect(() => {
    let active = true;
    apiFetch<{ data: ReportItem[] }>(`/api/admin/reports?status=${status}`)
      .then((r) => active && setItems(r.data))
      .catch((err) => {
        if (!active) return;
        if ((err as Error & { status?: number }).status === 401) onUnauthorized();
        setError((err as Error).message);
      });
    return () => {
      active = false;
    };
  }, [status, onUnauthorized]);

  return (
    <section aria-label="Laporan pengguna">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["pending", "Menunggu"],
            ["approved", "Disetujui"],
            ["rejected", "Ditolak"],
            ["all", "Semua"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={status === value}
            onClick={() => {
              if (value === status) return;
              setItems(null);
              setError(null);
              setStatus(value);
            }}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${
              status === value ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:border-ink-faint"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 rounded-lg bg-outdated-bg px-3 py-2 text-sm text-outdated">{error}</p>}
      {items === null ? (
        <p className="mt-6 text-ink-soft">Memuat laporan…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-ink-soft">
          {status === "pending" ? "Tidak ada laporan yang menunggu. Semua sudah ditinjau." : "Belum ada laporan di daftar ini."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((r) => (
            <ReportCard key={r.id} report={r} onDone={load} onUnauthorized={onUnauthorized} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportCard({
  report,
  onDone,
  onUnauthorized,
}: {
  report: ReportItem;
  onDone: () => void;
  onUnauthorized: () => void;
}) {
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view");
  const loc = report.location;
  const [name, setName] = useState(
    report.category === "wrong_name" && report.suggested_name ? report.suggested_name : loc?.name ?? "",
  );
  const [description, setDescription] = useState(loc?.description ?? "");
  const [verification, setVerification] = useState<VerificationStatus>(loc?.verification_status ?? "unverified");
  const [flagRoute, setFlagRoute] = useState(report.category === "moved");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(action: "approve" | "reject") {
    setError(null);
    setSending(true);
    try {
      const changes: Record<string, unknown> = {};
      if (action === "approve" && loc) {
        if (name.trim() && name.trim() !== loc.name) changes.name = name.trim();
        if (description.trim() !== (loc.description ?? "")) changes.description = description.trim() || null;
        if (verification !== loc.verification_status) changes.verification_status = verification;
      }
      await apiFetch(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          admin_note: note.trim() || null,
          ...(action === "approve" && loc ? { location_changes: changes, flag_route_review: flagRoute } : {}),
        }),
      });
      onDone();
    } catch (err) {
      if ((err as Error & { status?: number }).status === 401) onUnauthorized();
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="rounded-xl border border-line bg-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">
            {loc ? loc.name : "Ruang/informasi baru"}{" "}
            <span className="font-semibold text-ink-soft">· {report.category_label}</span>
          </p>
          <p className="text-xs text-ink-faint">
            Laporan #{report.id}, dikirim {fmtDate(report.created_at)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            report.status === "pending"
              ? "bg-unverified-bg text-unverified"
              : report.status === "approved"
                ? "bg-[#e3f4ec] text-verified"
                : "bg-paper text-ink-soft"
          }`}
        >
          {{ pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" }[report.status]}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm">{report.description}</p>
      {report.suggested_name && (
        <p className="mt-2 text-sm">
          <span className="text-ink-soft">Usulan nama:</span> <strong>{report.suggested_name}</strong>
        </p>
      )}
      {report.status !== "pending" && (
        <p className="mt-3 text-xs text-ink-soft">
          Ditinjau {report.reviewed_by ? `oleh ${report.reviewed_by} ` : ""}
          {report.reviewed_at ? fmtDate(report.reviewed_at) : ""}
          {report.admin_note ? `. Catatan: ${report.admin_note}` : ""}
        </p>
      )}

      {report.status === "pending" && mode === "view" && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setMode("approve")}
            className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-white hover:bg-go-strong"
          >
            Tinjau dan setujui
          </button>
          <button
            onClick={() => setMode("reject")}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper"
          >
            Tolak
          </button>
        </div>
      )}

      {report.status === "pending" && mode !== "view" && (
        <div className="mt-4 rounded-lg bg-paper p-4">
          {mode === "approve" && loc && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Nama lokasi
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} className={inputCls} />
              </label>
              <label className="text-sm font-semibold">
                Status verifikasi
                <select
                  value={verification}
                  onChange={(e) => setVerification(e.target.value as VerificationStatus)}
                  className={inputCls}
                >
                  <option value="unverified">Belum terverifikasi</option>
                  <option value="verified">Terverifikasi (sudah dicek langsung)</option>
                  <option value="outdated">Perlu dicek ulang</option>
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Deskripsi
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className={inputCls}
                />
              </label>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={flagRoute}
                  onChange={(e) => setFlagRoute(e.target.checked)}
                  className="mt-0.5 accent-[var(--ink)]"
                />
                <span>
                  <strong>Tandai rute perlu verifikasi ulang.</strong> Pilih ini bila posisi atau pintu berubah; koridor
                  di sekitar titik masuk akan ditandai usang.
                </span>
              </label>
            </div>
          )}
          {mode === "approve" && !loc && (
            <p className="text-sm text-ink-soft">
              Laporan ini tidak terkait lokasi yang ada. Menyetujui hanya mencatat bahwa laporan valid; tambahkan lokasi
              baru lewat data seed setelah posisinya dipastikan.
            </p>
          )}
          <label className="mt-3 block text-sm font-semibold">
            Catatan admin <span className="font-normal text-ink-soft">(opsional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={inputCls} />
          </label>
          {error && <p className="mt-3 rounded-lg bg-outdated-bg px-3 py-2 text-sm text-outdated">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => submit(mode === "approve" ? "approve" : "reject")}
              disabled={sending}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                mode === "approve" ? "bg-go hover:bg-go-strong" : "bg-outdated hover:bg-outdated/90"
              }`}
            >
              {sending ? "Menyimpan…" : mode === "approve" ? "Setujui dan terapkan" : "Tolak laporan"}
            </button>
            <button
              onClick={() => setMode("view")}
              className="rounded-lg border border-line bg-raised px-4 py-2 text-sm font-semibold hover:bg-paper"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function LocationsPanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [locations, setLocations] = useState<LocationDto[] | null>(null);
  const [editing, setEditing] = useState<LocationDto | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch<{ data: LocationDto[] }>("/api/locations?floor_id=1");
    setLocations(r.data);
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<{ data: LocationDto[] }>("/api/locations?floor_id=1").then((r) => active && setLocations(r.data));
    return () => {
      active = false;
    };
  }, []);

  if (!locations) return <p className="text-ink-soft">Memuat lokasi…</p>;

  return (
    <section aria-label="Data lokasi" className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <ul className="divide-y divide-line rounded-xl border border-line bg-raised">
        {locations.map((l) => (
          <li key={l.id}>
            <button
              onClick={() => setEditing(l)}
              aria-current={editing?.id === l.id ? "true" : undefined}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper ${
                editing?.id === l.id ? "bg-paper" : ""
              }`}
            >
              <span>
                <span className="block font-semibold">{l.name}</span>
                <span className="block text-xs text-ink-soft">
                  {l.type_label}
                  {l.routable ? "" : ", rute belum tersedia"}
                </span>
              </span>
              <StatusBadge status={l.verification_status} />
            </button>
          </li>
        ))}
      </ul>
      {editing ? (
        <LocationEditor
          key={editing.id}
          loc={editing}
          onSaved={async (updated) => {
            setEditing(updated);
            await load();
          }}
          onUnauthorized={onUnauthorized}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-ink-soft">
          Pilih lokasi untuk mengubah nama, deskripsi, posisi penanda, atau status verifikasinya.
        </p>
      )}
    </section>
  );
}

function LocationEditor({
  loc,
  onSaved,
  onUnauthorized,
}: {
  loc: LocationDto;
  onSaved: (l: LocationDto) => void;
  onUnauthorized: () => void;
}) {
  const [form, setForm] = useState({
    name: loc.name,
    short_name: loc.short_name ?? "",
    aliases: loc.aliases.join(", "),
    type: loc.type,
    description: loc.description ?? "",
    marker_x: String(loc.marker.x),
    marker_y: String(loc.marker.y),
    verification_status: loc.verification_status,
    source_type: loc.source_type,
    needs_route_review: loc.needs_route_review,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const r = await apiFetch<{ data: LocationDto }>(`/api/admin/locations/${loc.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          short_name: form.short_name.trim() || null,
          aliases: form.aliases.trim() || null,
          type: form.type,
          description: form.description.trim() || null,
          marker_x: Number(form.marker_x),
          marker_y: Number(form.marker_y),
          verification_status: form.verification_status,
          source_type: form.source_type,
          needs_route_review: form.needs_route_review,
        }),
      });
      setMsg({ ok: true, text: "Perubahan disimpan dan sudah tampil di peta." });
      onSaved(r.data);
    } catch (err) {
      if ((err as Error & { status?: number }).status === 401) onUnauthorized();
      const details = (err as Error & { details?: { field: string; message: string }[] }).details;
      setMsg({
        ok: false,
        text: details?.length ? details.map((d) => `${d.field}: ${d.message}`).join("; ") : (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-line bg-raised p-5">
      <h2 className="text-lg font-bold">Ubah {loc.name}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Nama
          <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={160} required className={inputCls} />
        </label>
        <label className="text-sm font-semibold">
          Nama singkat
          <input value={form.short_name} onChange={(e) => set("short_name", e.target.value)} maxLength={40} className={inputCls} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Kata kunci pencarian <span className="font-normal text-ink-soft">(pisahkan dengan koma)</span>
          <input value={form.aliases} onChange={(e) => set("aliases", e.target.value)} maxLength={300} className={inputCls} />
        </label>
        <label className="text-sm font-semibold">
          Jenis
          <select value={form.type} onChange={(e) => set("type", e.target.value)} className={inputCls}>
            {TYPE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Status verifikasi
          <select
            value={form.verification_status}
            onChange={(e) => set("verification_status", e.target.value as VerificationStatus)}
            className={inputCls}
          >
            <option value="unverified">Belum terverifikasi</option>
            <option value="verified">Terverifikasi</option>
            <option value="outdated">Perlu dicek ulang</option>
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Deskripsi
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            maxLength={1000}
            className={inputCls}
          />
        </label>
        <label className="text-sm font-semibold">
          Sumber data
          <select
            value={form.source_type}
            onChange={(e) => set("source_type", e.target.value as LocationDto["source_type"])}
            className={inputCls}
          >
            <option value="reference_map">Denah referensi</option>
            <option value="field_verified">Dicek di lapangan</option>
            <option value="demo_simulation">Simulasi demo</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            Penanda X
            <input
              type="number"
              step="0.005"
              min={0}
              max={1}
              value={form.marker_x}
              onChange={(e) => set("marker_x", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-sm font-semibold">
            Penanda Y
            <input
              type="number"
              step="0.005"
              min={0}
              max={1}
              value={form.marker_y}
              onChange={(e) => set("marker_y", e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.needs_route_review}
            onChange={(e) => set("needs_route_review", e.target.checked)}
            className="accent-[var(--ink)]"
          />
          Rute ke lokasi ini perlu verifikasi ulang
        </label>
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        Koordinat penanda memakai skala relatif 0–1 terhadap kanvas denah. Pilih &quot;Terverifikasi&quot; hanya bila
        sudah dicek langsung di lokasi.
      </p>
      {msg && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-[#e3f4ec] text-verified" : "bg-outdated-bg text-outdated"}`}
        >
          {msg.text}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
      >
        {saving ? "Menyimpan…" : "Simpan perubahan"}
      </button>
    </form>
  );
}
