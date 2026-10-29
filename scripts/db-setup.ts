/**
 * Menjalankan migrasi database lalu menyinkronkan data seed.
 * Dipanggil otomatis sebelum `next build` (lihat package.json), sehingga
 * deploy ke Vercel cukup dengan mengisi DATABASE_URL.
 *
 * Opsi:
 *   --force   paksa sinkronisasi data peta walau SEED_VERSION sama.
 *   --skip-if-no-db   lewati tanpa error bila DATABASE_URL kosong (untuk build lokal).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { syncMapData, ensureAdmin } from "../src/db/seed";

async function main() {
  const args = new Set(process.argv.slice(2));
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    if (args.has("--skip-if-no-db")) {
      console.warn("[db-setup] DATABASE_URL kosong, migrasi & seed dilewati.");
      return;
    }
    throw new Error("DATABASE_URL belum diatur.");
  }

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  try {
    console.log("[db-setup] Menjalankan migrasi…");
    await migrate(db, { migrationsFolder: "./drizzle" });
    await syncMapData(db, { force: args.has("--force") });
    await ensureAdmin(db);
    console.log("[db-setup] Selesai.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
