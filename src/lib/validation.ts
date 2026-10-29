import { z } from "zod";

// Pesan validasi bawaan dalam Bahasa Indonesia.
z.config(z.locales.id());

/** Menghapus karakter kontrol dan merapikan spasi pada input teks bebas. */
const cleanText = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(
      z
        .string()
        .min(min, `${label} minimal ${min} karakter.`)
        .max(max, `${label} maksimal ${max} karakter.`),
    );

export const locationTypes = [
  "entrance",
  "library",
  "service",
  "retail",
  "bank",
  "vertical_access",
  "office",
  "room",
  "toilet",
  "food",
  "other",
] as const;

export const verificationStatuses = ["unverified", "verified", "outdated"] as const;
export const sourceTypes = ["reference_map", "field_verified", "demo_simulation"] as const;
export const reportCategories = ["wrong_name", "moved", "facility_changed", "other"] as const;

/** Query pencarian lokasi: GET /api/locations */
export const locationQuerySchema = z.object({
  floor_id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(80, "Kata kunci maksimal 80 karakter.").optional(),
  type: z.enum(locationTypes).optional(),
});

/** ID numerik atau slug lokasi. */
export const locationRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/i, "ID lokasi tidak valid.");

/** Query rute: GET /api/routes?from=..&to=.. */
export const routeQuerySchema = z.object({
  from: locationRefSchema,
  to: locationRefSchema,
});

/** Body laporan: POST /api/reports */
export const reportCreateSchema = z.object({
  location_id: z.number().int().positive().nullable().optional(),
  category: z.enum(reportCategories, { error: "Jenis laporan tidak valid." }),
  description: cleanText(10, 1000, "Deskripsi"),
  suggested_name: cleanText(2, 160, "Usulan nama").optional().nullable(),
  /** Honeypot anti-bot: harus kosong. */
  website: z.string().max(0).optional(),
});

/** Login admin */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid.").max(160),
  password: z.string().min(1, "Password wajib diisi.").max(200),
});

/** Perubahan data lokasi oleh admin. */
export const locationUpdateSchema = z
  .object({
    name: cleanText(2, 160, "Nama"),
    short_name: cleanText(1, 40, "Nama singkat").nullable(),
    aliases: cleanText(0, 300, "Alias").nullable(),
    type: z.enum(locationTypes),
    description: cleanText(0, 1000, "Deskripsi").nullable(),
    marker_x: z.number().min(0).max(1),
    marker_y: z.number().min(0).max(1),
    verification_status: z.enum(verificationStatuses),
    source_type: z.enum(sourceTypes),
    needs_route_review: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Tidak ada perubahan yang dikirim.");

/** Keputusan admin atas laporan: PATCH /api/admin/reports/{id} */
export const reportReviewSchema = z.object({
  action: z.enum(["approve", "reject"], { error: "Aksi harus approve atau reject." }),
  admin_note: cleanText(0, 1000, "Catatan admin").optional().nullable(),
  /** Perubahan lokasi yang diterapkan bersamaan dengan persetujuan. */
  location_changes: z
    .object({
      name: cleanText(2, 160, "Nama"),
      short_name: cleanText(1, 40, "Nama singkat").nullable(),
      description: cleanText(0, 1000, "Deskripsi").nullable(),
      type: z.enum(locationTypes),
      verification_status: z.enum(verificationStatuses),
    })
    .partial()
    .optional(),
  /** Tandai rute ke lokasi ini perlu verifikasi ulang (otomatis untuk kategori "moved"). */
  flag_route_review: z.boolean().optional(),
});

export const reportListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
});

export const idParamSchema = z.coerce.number().int().positive();
