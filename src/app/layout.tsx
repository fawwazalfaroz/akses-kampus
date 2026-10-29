import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "AksesKampus — Navigasi ruangan BINUS Anggrek",
  description:
    "Cari ruangan dan fasilitas, lihat denah lantai 1, dan temukan rute di dalam gedung BINUS Anggrek. Data menampilkan status verifikasinya secara terbuka.",
  applicationName: "AksesKampus",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d2b36",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
