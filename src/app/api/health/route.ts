import { connection, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/** GET /api/health — cek status aplikasi dan koneksi database. */
export async function GET() {
  await connection();
  const started = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json(
      { status: "ok", database: "ok", latency_ms: Date.now() - started, time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[health]", err);
    return NextResponse.json(
      { status: "degraded", database: "unreachable", time: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
