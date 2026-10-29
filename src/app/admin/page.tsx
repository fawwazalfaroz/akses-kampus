import type { Metadata } from "next";
import { AdminApp } from "@/components/AdminApp";

export const metadata: Metadata = {
  title: "Panel admin — AksesKampus",
  robots: { index: false, follow: false },
};

/** Panel admin: autentikasi & data diambil lewat endpoint /api/admin/* (cookie HttpOnly). */
export default function AdminPage() {
  return <AdminApp />;
}
