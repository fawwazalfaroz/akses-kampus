import type { SourceType, VerificationStatus } from "@/lib/types";

const STATUS: Record<VerificationStatus, { label: string; className: string }> = {
  verified: { label: "Terverifikasi", className: "bg-[#e3f4ec] text-verified ring-verified/30" },
  unverified: { label: "Belum terverifikasi", className: "bg-unverified-bg text-unverified ring-unverified/30" },
  outdated: { label: "Perlu dicek ulang", className: "bg-outdated-bg text-outdated ring-outdated/30" },
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  reference_map: "Denah referensi",
  field_verified: "Dicek di lapangan",
  demo_simulation: "Simulasi demo",
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.className}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          status === "verified" ? "bg-verified" : status === "outdated" ? "bg-outdated" : "bg-unverified"
        }`}
      />
      {s.label}
    </span>
  );
}

export function RouteStatusBadge({ status }: { status: "verified" | "simulation" | "needs_review" }) {
  const map = {
    verified: { label: "Rute terverifikasi", cls: "bg-[#e3f4ec] text-verified ring-verified/30" },
    simulation: { label: "Simulasi", cls: "bg-signal/25 text-ink ring-ink/20" },
    needs_review: { label: "Perlu verifikasi ulang", cls: "bg-outdated-bg text-outdated ring-outdated/30" },
  }[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${map.cls}`}>
      {map.label}
    </span>
  );
}
