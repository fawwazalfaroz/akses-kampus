import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __aksesKampusSql?: ReturnType<typeof postgres>;
  __aksesKampusDb?: Db;
};

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL belum diatur. Lihat README bagian Konfigurasi.");
  }
  const sql =
    globalForDb.__aksesKampusSql ??
    postgres(url, {
      // prepare:false agar kompatibel dengan connection pooler (Neon/PgBouncer).
      prepare: false,
      max: process.env.NODE_ENV === "production" ? 3 : 5,
      idle_timeout: 20,
    });
  globalForDb.__aksesKampusSql = sql;
  return drizzle(sql, { schema });
}

/** Koneksi database dibuat saat pertama dipakai, bukan saat modul diimpor. */
export function getDb(): Db {
  if (!globalForDb.__aksesKampusDb) {
    globalForDb.__aksesKampusDb = createDb();
  }
  return globalForDb.__aksesKampusDb;
}

export { schema };
