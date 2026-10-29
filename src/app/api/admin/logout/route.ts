import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { apiError, isSameOrigin } from "@/lib/http";

/** POST /api/admin/logout — menghapus cookie sesi. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError(403, "forbidden", "Origin tidak diizinkan.");
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ data: { logged_out: true } });
}
