import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/** Hash IP agar alamat IP mentah tidak pernah disimpan. */
export function hashIp(ip: string) {
  const salt = process.env.AUTH_SECRET ?? "akses-kampus";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Pembatas laju fixed-window berbasis Postgres (atomik lewat UPSERT),
 * sehingga tetap konsisten walau aplikasi berjalan di banyak instance serverless.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const rows = await getDb().execute<{ count: number; window_start: string }>(sql`
    insert into rate_limits (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case
        when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
          then 1 else rate_limits.count + 1 end,
      window_start = case
        when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
          then now() else rate_limits.window_start end
    returning count, window_start
  `);
  const row = rows[0];
  const count = Number(row.count);
  const windowStart = new Date(row.window_start).getTime();
  const retryAfter = Math.max(1, Math.ceil((windowStart + windowSeconds * 1000 - Date.now()) / 1000));
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter };
}
