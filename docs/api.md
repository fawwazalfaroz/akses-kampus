# Dokumentasi REST API AksesKampus

Base URL: `https://<domain-deploy>` (lokal: `http://localhost:3000`). Semua respons berformat JSON.

## Konvensi

- Respons sukses: `{ "data": ... }` (beberapa endpoint menambah `meta` atau `message`).
- Respons error: `{ "error": { "code": "...", "message": "...", "details": [ { "field", "message" } ] } }`.
- Body request harus `Content-Type: application/json`.
- Koordinat (`x`, `y`, `marker`) relatif 0–1 terhadap kanvas denah. Jarak (`distance`) dalam `map_units`, **bukan meter**.

| Kode HTTP | `error.code` | Arti |
|---|---|---|
| 400 | `validation_error` / `bad_request` | Input tidak valid |
| 401 | `unauthorized` | Belum login admin / kredensial salah |
| 403 | `forbidden` | Origin request tidak diizinkan |
| 404 | `not_found` | Data tidak ditemukan |
| 409 | `conflict` | Laporan sudah ditinjau |
| 415 | `unsupported_media_type` | Body bukan JSON |
| 429 | `rate_limited` | Terlalu banyak request (lihat header `Retry-After`) |
| 500 | `server_error` | Kesalahan server |

## Publik

### `GET /api/health`
Status aplikasi dan koneksi database.
```json
{ "status": "ok", "database": "ok", "latency_ms": 3, "time": "2026-10-29T10:00:00.000Z" }
```

### `GET /api/floors/{id}`
Data lantai, aset denah, dan status sumbernya.
```json
{
  "data": {
    "id": 1, "number": 1, "name": "Lantai 1",
    "building": { "id": 1, "slug": "binus-anggrek", "name": "BINUS Anggrek", "campus": "Kemanggisan, Jakarta Barat" },
    "map": { "asset": null, "width": 1600, "height": 1000, "coordinate_system": "relative_0_1",
             "source_note": "...", "verification_status": "unverified" },
    "stats": { "locations": 9, "nodes": 14, "edges": 13 }
  }
}
```

### `GET /api/floors/{id}/graph`
Node dan edge aktif (jaringan jalur) untuk visualisasi.

### `GET /api/locations`
Pencarian dan filter lokasi.

| Query | Tipe | Keterangan |
|---|---|---|
| `floor_id` | angka | opsional |
| `q` | teks ≤ 80 | dicocokkan ke nama, singkatan, slug, kata kunci |
| `type` | enum | `entrance`, `library`, `service`, `retail`, `bank`, `vertical_access`, `office`, `room`, `other` |

Contoh: `GET /api/locations?floor_id=1&q=perpus`
```json
{
  "data": [{
    "id": 2, "slug": "lkc", "name": "Library & Knowledge Center", "short_name": "LKC",
    "type": "library", "type_label": "Perpustakaan",
    "marker": { "x": 0.3, "y": 0.3 }, "routable": true,
    "verification_status": "unverified", "source_type": "reference_map",
    "needs_route_review": false, "updated_at": "..."
  }],
  "meta": { "count": 1, "query": "perpus" }
}
```

### `GET /api/locations/{id|slug}`
Detail satu lokasi. Menerima ID angka (`/api/locations/2`) atau slug (`/api/locations/lkc`).

### `GET /api/routes?from={id|slug}&to={id|slug}`
Mencari rute dengan Dijkstra atas graph koridor.

Rute ditemukan:
```json
{
  "status": "ok",
  "route_status": "simulation",
  "from": { "id": 1, "slug": "lobby", "name": "Lobby", "marker": { "x": 0.5, "y": 0.88 } },
  "to": { "id": 2, "slug": "lkc", "name": "Library & Knowledge Center", "marker": { "x": 0.3, "y": 0.3 } },
  "floor_id": 1,
  "distance": 0.66,
  "distance_unit": "map_units",
  "waypoints": [ { "node_id": 1, "x": 0.5, "y": 0.84 }, "..." ],
  "steps": ["Mulai dari Lobby.", "Jalan lurus mengikuti koridor.", "Belok kiri di koridor tengah.", "Belok kanan di koridor barat.", "Tiba di LKC."],
  "notice": "Simulasi: rute demo berdasarkan data jalur yang belum divalidasi di lokasi."
}
```

`route_status`:
- `verified`: semua node dan edge di rute berstatus terverifikasi.
- `simulation`: ada data yang belum diverifikasi.
- `needs_review`: ada edge usang atau lokasi yang ditandai perlu dicek ulang.

Rute tidak tersedia (HTTP 200, tanpa garis tebakan):
```json
{
  "status": "route_unavailable",
  "reason": "Titik masuk Ruang belum teridentifikasi belum dipetakan, rute belum tersedia.",
  "from": { "...": "..." }, "to": { "...": "..." },
  "waypoints": []
}
```

### `POST /api/reports`
Mengirim laporan perubahan. Batas: 5 laporan per 10 menit per IP.

```json
{
  "location_id": 2,
  "category": "wrong_name",
  "description": "Papan nama di pintu sekarang bertuliskan Library.",
  "suggested_name": "Library"
}
```
- `location_id` boleh `null` untuk ruang yang belum ada di data.
- `category`: `wrong_name`, `moved`, `facility_changed`, `other`.
- `description`: 10–1000 karakter. `suggested_name`: opsional, 2–160 karakter.

Respons `201`:
```json
{ "data": { "id": 7, "status": "pending", "created_at": "..." },
  "message": "Laporan diterima dan menunggu peninjauan admin. Informasi publik belum berubah." }
```

## Admin (butuh sesi)

Sesi disimpan di cookie `ak_session` (HttpOnly). Tanpa sesi valid → `401`.

### `POST /api/admin/login`
```json
{ "email": "admin@example.com", "password": "..." }
```
Batas: 8 percobaan per 15 menit per IP.

### `POST /api/admin/logout`

### `GET /api/admin/me`

### `GET /api/admin/reports?status=pending|approved|rejected|all`
Daftar laporan beserta lokasi terkait.

### `PATCH /api/admin/reports/{id}`
```json
{
  "action": "approve",
  "admin_note": "Sudah dicek foto papan nama",
  "location_changes": { "name": "Library", "verification_status": "verified" },
  "flag_route_review": false
}
```
- `action`: `approve` atau `reject`.
- `location_changes` (opsional, hanya saat approve): `name`, `short_name`, `description`, `type`, `verification_status`.
- `flag_route_review`: tandai rute ke lokasi perlu dicek ulang; bawaan `true` untuk kategori `moved`. Edge di sekitar titik masuk lokasi ditandai `outdated`.
- Laporan yang sudah ditinjau → `409`.

### `PATCH /api/admin/locations/{id}`
Ubah sebagian field lokasi: `name`, `short_name`, `aliases`, `type`, `description`, `marker_x`, `marker_y`, `verification_status`, `source_type`, `needs_route_review`. Setiap perubahan dicatat di `audit_logs`.

## Contoh dengan curl

```bash
B=https://<domain>
curl "$B/api/locations?q=lkc"
curl "$B/api/routes?from=lobby&to=lkc"
curl -X POST "$B/api/reports" -H 'content-type: application/json' \
  -d '{"location_id":2,"category":"other","description":"Jam buka berubah menjadi 08.00"}'
curl -c ck.txt -X POST "$B/api/admin/login" -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"..."}'
curl -b ck.txt "$B/api/admin/reports?status=pending"
```
