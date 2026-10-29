# Pengujian

## 1. Unit test (otomatis)

`npm test` menjalankan [`tests/routing.test.ts`](../tests/routing.test.ts) dengan test runner bawaan Node.js:

| Kasus | Hasil yang diharapkan |
|---|---|
| Jalur dengan bobot total terkecil | Dijkstra memilih 1→2→3→5 (bobot 3), bukan 1→4→5 (bobot 6) |
| Edge tidak aktif | Tidak dipakai; rute berpindah ke jalur lain |
| Node tidak terhubung | `found: false` (menjadi `route_unavailable` di API) |
| Node tidak dikenal | `found: false` |
| Edge dua arah | Rute balik ditemukan |
| Titik awal = tujuan | Jalur satu node, bobot 0 |
| Arah belok | Kiri/kanan dihitung benar dengan sumbu y ke bawah |
| Instruksi teks | Diawali titik awal, diakhiri tujuan |

## 2. Uji fungsional API dan UI

Dijalankan pada lingkungan lokal (PostgreSQL 16) tanggal 29 Oktober 2026 dengan `curl` dan Playwright (Chromium).

| Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|
| Buka halaman lantai 1 (1440×900 dan 390×844) | Denah tampil, tidak rusak | Lulus |
| Cari "perpus" | LKC muncul dan tersorot | Lulus |
| Klik penanda ruangan | Panel detail + status validasi tampil | Lulus |
| Rute Lobby → LKC | Waypoints dari server, garis mengikuti edge, label Simulasi | Lulus |
| Rute ke "Ruang belum teridentifikasi" | `route_unavailable`, tanpa garis | Lulus |
| Lokasi tidak ada | `404 not_found` | Lulus |
| Parameter rute kurang | `400 validation_error` | Lulus |
| Kirim laporan kosong | Ditolak dengan pesan per field | Lulus |
| Kirim laporan valid | `201`, status `pending`, data publik belum berubah | Lulus |
| Admin menyetujui laporan | Nama lokasi publik berubah | Lulus |
| Menyetujui laporan yang sudah ditinjau | `409 conflict` | Lulus |
| Endpoint admin tanpa login | `401 unauthorized` | Lulus |
| Login dengan password salah | `401` | Lulus |
| Request dari Origin lain | `403 forbidden` | Lulus |
| Body bukan JSON | `415` | Lulus |

## 3. Pengujian pengguna

Belum dilakukan saat dokumen ini ditulis. Isi tabel berikut **dengan hasil nyata** setelah menguji ke beberapa orang yang belum mengenal aplikasi. Jangan mengisi angka perkiraan.

Tugas yang diuji:
1. Temukan lokasi perpustakaan (LKC) di peta.
2. Tampilkan rute dari Lobby ke BCA.
3. Laporkan bahwa nama sebuah ruangan salah.

| Responden | Peran | Tugas 1 (berhasil? detik) | Tugas 2 | Tugas 3 | Komentar |
|---|---|---|---|---|---|
| R1 | | | | | |
| R2 | | | | | |
| R3 | | | | | |

Ringkasan yang dilaporkan: jumlah responden, tingkat keberhasilan per tugas, median waktu, dan temuan utama.
