# Sumber dan kebijakan data

## Sumber yang dipakai

| Sumber | Dipakai untuk | Status |
|---|---|---|
| Denah lantai 1 BINUS Anggrek **tahun 2020** (screenshot, `public/maps/lantai-1-denah-2020.png`) | Gambar dasar peta; nama area: Lobby, LKC, SRSC, BINUS Megastore, BCA, ATM BCA, Lab. Restoran Hotel Management, A&W, iBOX, WC, elevator, dua eskalator, Admisi | Referensi lama. Menurut tim, beberapa lokasi saat ini sudah berbeda dan belum ada denah terbaru |
| Foto/video tur kampus | Gambaran visual saja | Bukan bukti hubungan koridor |
| Guidebook UINIC 8.0 | Ketentuan lomba | — |

## Catatan denah 2020

- Area abu-abu di sisi kanan denah (**Admisi** dan dua WC) adalah **gedung terpisah**. Admisi ditampilkan sebagai lokasi, tetapi tidak dihubungkan ke graph rute lantai ini; API mengembalikan `route_unavailable` dengan alasan "gedung terpisah".
- Label "Admin" pada spesifikasi awal dikoreksi menjadi **Admisi** sesuai denah.
- Ruang di selatan ATM BCA tidak berlabel; ditampilkan sebagai "Ruang tanpa label" tanpa rute.
- Karena denah berumur, semua lokasi berstatus **Belum terverifikasi** dan deskripsinya menyebut "tercatat pada denah 2020". Perubahan terkini masuk lewat fitur laporan dan disetujui admin.

## Kebijakan

1. **Nama bukan verifikasi.** Nama yang tertulis di denah belum tentu sesuai kondisi saat ini. Semua lokasi awal berstatus `unverified` dengan sumber `reference_map`.
2. **Geometri tidak dikarang.** Gambar denah dipakai apa adanya sebagai *base layer*; overlay titik dan jalur terpisah dari gambar. Selama gambar denah belum dipasang, aplikasi menampilkan kanvas grid dengan keterangan "Denah referensi belum dipasang".
3. **Jalur simulasi diberi label.** Node dan edge berstatus `demo_simulation` + `unverified`. Rute yang melewatinya selalu berlabel *Simulasi*.
4. **Tidak ada garis tebakan.** Lokasi tanpa titik masuk yang terpetakan (contoh: "Ruang belum teridentifikasi") sengaja tidak bisa dirutekan; API mengembalikan `route_unavailable`.
5. **Tidak ada satuan meter** sebelum skala peta dikalibrasi.
6. **Perubahan publik hanya lewat admin.** Laporan pengguna tersimpan `pending`; data publik berubah setelah admin menyetujui, dan tercatat di `audit_logs`.
7. **Hak pakai.** Gambar denah dan foto kampus adalah milik pemiliknya; periksa izin sebelum mendistribusikan ulang aset publik.

## Cara memperbarui data peta

1. Simpan gambar denah di `public/maps/` dan isi `floor.mapAsset`, `width`, `height` di `src/db/seed-data.ts` sesuai ukuran piksel gambar.
2. Sesuaikan koordinat `nodes`, `edges`, dan `locations` (relatif 0–1 terhadap gambar).
3. Naikkan `SEED_VERSION`, lalu jalankan `npm run db:setup` (atau deploy ulang).
4. Setelah dicek langsung di lokasi, ubah status menjadi `verified` dan sumber menjadi `field_verified` lewat panel admin.
