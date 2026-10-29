import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withErrorHandling } from "@/lib/http";

/** GET /api/admin/me — info admin yang sedang login (401 bila belum). */
export const GET = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json(
    { data: { id: auth.session.adminId, email: auth.session.email, name: auth.session.name } },
    { headers: { "Cache-Control": "no-store" } },
  );
});
