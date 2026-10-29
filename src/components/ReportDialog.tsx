"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, type LocationDto } from "@/lib/types";
import { CheckIcon, CloseIcon } from "./icons";

const CATEGORIES = [
  { value: "wrong_name", label: "Nama ruangan salah", hint: "Nama di papan berbeda dengan di aplikasi" },
  { value: "moved", label: "Ruangan pindah", hint: "Ruangan/fasilitas sudah tidak di posisi ini" },
  { value: "facility_changed", label: "Fasilitas berubah", hint: "Fungsi, layanan, atau kondisi berubah" },
  { value: "other", label: "Lainnya", hint: "Termasuk ruang yang belum ada di peta" },
] as const;

type Props = {
  open: boolean;
  location: LocationDto | null;
  onClose: () => void;
};

export function ReportDialog({ open, location, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<string>(location ? "wrong_name" : "other");
  const [description, setDescription] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setCategory(location ? "wrong_name" : "other");
      setDescription("");
      setSuggestedName("");
      setState("idle");
      setError(null);
      setFieldErrors({});
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, location]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const errs: Record<string, string> = {};
    if (description.trim().length < 10) errs.description = "Jelaskan minimal 10 karakter agar admin bisa memeriksa.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setState("sending");
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          location_id: location?.id ?? null,
          category,
          description,
          suggested_name: suggestedName.trim() ? suggestedName : null,
          website,
        }),
      });
      setState("sent");
    } catch (err) {
      setState("idle");
      const details = (err as Error & { details?: { field: string; message: string }[] }).details;
      if (details?.length) {
        setFieldErrors(Object.fromEntries(details.map((d) => [d.field, d.message])));
      }
      setError((err as Error).message);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="report-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-raised p-0 text-ink shadow-xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id="report-title" className="text-lg font-bold">
            {location ? "Laporkan perubahan" : "Laporkan ruang atau informasi baru"}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {location ? location.name : "Ruang yang belum ada di peta atau informasi lain"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-paper"
        >
          <CloseIcon />
        </button>
      </div>

      {state === "sent" ? (
        <div className="px-5 py-6">
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-go text-white">
              <CheckIcon />
            </span>
            <div>
              <p className="font-semibold">Laporan terkirim</p>
              <p className="mt-1 text-sm text-ink-soft">
                Admin akan memeriksa laporan ini. Informasi di peta baru berubah setelah laporan disetujui.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-lg bg-ink px-4 py-2.5 font-semibold text-white hover:bg-ink/90"
          >
            Kembali ke peta
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 px-5 py-5" noValidate>
          <fieldset>
            <legend className="text-sm font-semibold">Jenis laporan</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)] ${
                    category === c.value ? "border-ink bg-paper" : "border-line"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="category"
                      value={c.value}
                      checked={category === c.value}
                      onChange={() => setCategory(c.value)}
                      className="accent-[var(--ink)]"
                    />
                    {c.label}
                  </span>
                  <span className="mt-0.5 pl-5 text-xs text-ink-soft">{c.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {(category === "wrong_name" || !location) && (
            <div>
              <label htmlFor="suggested" className="text-sm font-semibold">
                {location ? "Nama yang benar" : "Nama ruang"} <span className="font-normal text-ink-soft">(opsional)</span>
              </label>
              <input
                id="suggested"
                value={suggestedName}
                onChange={(e) => setSuggestedName(e.target.value)}
                maxLength={160}
                className="mt-1.5 w-full rounded-lg border border-line bg-raised px-3 py-2"
                aria-invalid={!!fieldErrors.suggested_name}
                aria-describedby={fieldErrors.suggested_name ? "suggested-err" : undefined}
              />
              {fieldErrors.suggested_name && (
                <p id="suggested-err" className="mt-1 text-sm text-outdated">
                  {fieldErrors.suggested_name}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="desc" className="text-sm font-semibold">
              Apa yang berbeda?
            </label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              required
              placeholder="Contoh: papan nama di pintu sekarang bertuliskan Library, bukan LKC."
              className="mt-1.5 w-full resize-y rounded-lg border border-line bg-raised px-3 py-2"
              aria-invalid={!!fieldErrors.description}
              aria-describedby="desc-help"
            />
            <div id="desc-help" className="mt-1 flex justify-between text-xs">
              <span className={fieldErrors.description ? "text-outdated" : "text-ink-soft"}>
                {fieldErrors.description ?? "Minimal 10 karakter. Jangan sertakan data pribadi."}
              </span>
              <span className="text-ink-faint">{description.length}/1000</span>
            </div>
          </div>

          {/* Honeypot: disembunyikan dari pengguna, diisi oleh bot. */}
          <div aria-hidden="true" className="absolute -left-[9999px]">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-outdated-bg px-3 py-2 text-sm text-outdated">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2.5 font-semibold hover:bg-paper"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={state === "sending"}
              className="flex-1 rounded-lg bg-go px-4 py-2.5 font-semibold text-white hover:bg-go-strong disabled:opacity-60"
            >
              {state === "sending" ? "Mengirim…" : "Kirim laporan"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
