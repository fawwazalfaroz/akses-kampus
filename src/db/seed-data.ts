/**
 * Data awal AksesKampus — Lantai 1 BINUS Anggrek.
 *
 * SUMBER: screenshot denah lantai 1 tahun 2020 (public/maps/lantai-1-denah-2020.png).
 * - Denah tahun 2020; menurut informasi tim, beberapa lokasi saat ini sudah berbeda
 *   dan belum ada denah terbaru. Semua lokasi berstatus "unverified".
 * - Area abu-abu di sisi kanan denah (Admisi) adalah gedung terpisah, sehingga
 *   tidak dihubungkan ke graph rute lantai ini.
 * - Node & edge koridor ditarik di area terbuka pada denah 2020 dan berstatus
 *   SIMULASI (demo_simulation) sampai dicek langsung di lokasi.
 * - Koordinat relatif 0–1 terhadap ukuran gambar denah (650 × 308 piksel),
 *   bukan meter dan bukan GPS.
 *
 * Naikkan SEED_VERSION setiap kali data di file ini diubah agar proses
 * sinkronisasi (npm run db:setup / build) memperbarui database.
 */

export const SEED_VERSION = "2026-10-29.5-lorong-lift";

export const building = {
  slug: "binus-anggrek",
  name: "BINUS Anggrek",
  campus: "Kemanggisan, Jakarta Barat",
};

export const floor = {
  number: 1,
  name: "Lantai 1",
  mapAsset: "/maps/lantai-1-denah-2020.png" as string | null,
  width: 650,
  height: 308,
  mapSourceLabel: "Denah referensi 2020",
  mapSourceNote:
    "Screenshot denah lantai 1 tahun 2020. Beberapa lokasi saat ini sudah berbeda dan belum ada denah terbaru. Area abu-abu (Admisi) adalah gedung terpisah. Jalur koridor adalah simulasi.",
};

type SeedNode = {
  code: string;
  label?: string;
  x: number;
  y: number;
  kind: "junction" | "corridor" | "entry";
};

export const nodes: SeedNode[] = [
  // Koridor utara (antara deretan ruang atas dan LKC)
  { code: "J-N1", label: "koridor depan Lab. Restoran", x: 0.14, y: 0.345, kind: "corridor" },
  { code: "J-N2", label: "depan A&W", x: 0.26, y: 0.345, kind: "corridor" },
  { code: "J-N3", label: "depan iBOX", x: 0.32, y: 0.345, kind: "corridor" },
  { code: "J-N-ELV", label: "ujung utara lorong lift", x: 0.36, y: 0.345, kind: "junction" },
  { code: "J-N4", label: "depan toilet", x: 0.4, y: 0.345, kind: "corridor" },
  { code: "J-N5", label: "ujung koridor utara", x: 0.49, y: 0.345, kind: "junction" },
  { code: "J-N6", label: "depan SRSC", x: 0.555, y: 0.345, kind: "corridor" },
  // Aula barat
  { code: "J-MID", label: "tengah aula", x: 0.25, y: 0.475, kind: "junction" },
  // Lorong sempit antara lift dan dinding barat LKC (menghubungkan sisi utara dan selatan)
  { code: "J-ELV", label: "depan lift", x: 0.36, y: 0.48, kind: "corridor" },
  // Sisi selatan (depan Megastore, BCA, Lobby)
  { code: "J-S1", label: "depan BINUS Megastore", x: 0.14, y: 0.605, kind: "corridor" },
  { code: "J-S2", label: "depan BCA", x: 0.29, y: 0.605, kind: "junction" },
  { code: "J-S-ELV", label: "ujung selatan lorong lift", x: 0.36, y: 0.605, kind: "junction" },
  { code: "J-LOBBY", label: "simpang depan Lobby", x: 0.42, y: 0.605, kind: "junction" },
  { code: "J-S5", label: "dekat eskalator selatan", x: 0.49, y: 0.6, kind: "junction" },
  // Titik masuk ruangan
  { code: "E-LOBBY", label: "Lobby", x: 0.42, y: 0.665, kind: "entry" },
  { code: "E-LKC", label: "pintu LKC", x: 0.41, y: 0.565, kind: "entry" },
  { code: "E-LAB", label: "pintu Lab. Restoran", x: 0.14, y: 0.31, kind: "entry" },
  { code: "E-AW", label: "A&W", x: 0.26, y: 0.31, kind: "entry" },
  { code: "E-IBOX", label: "iBOX", x: 0.32, y: 0.31, kind: "entry" },
  { code: "E-WC", label: "toilet", x: 0.4, y: 0.31, kind: "entry" },
  { code: "E-SRSC", label: "pintu SRSC", x: 0.555, y: 0.31, kind: "entry" },
  { code: "E-MEGA", label: "pintu BINUS Megastore", x: 0.14, y: 0.64, kind: "entry" },
  { code: "E-BCA", label: "pintu BCA", x: 0.29, y: 0.64, kind: "entry" },
  // Bukaan lift ada di sisi timur (sisi kanan pada denah); sisi barat tertutup dinding.
  { code: "E-ELEV", label: "elevator", x: 0.343, y: 0.48, kind: "entry" },
  { code: "E-ESC-N", label: "eskalator utara", x: 0.5, y: 0.377, kind: "entry" },
  { code: "E-ESC-S", label: "eskalator selatan", x: 0.5, y: 0.586, kind: "entry" },
  { code: "E-ATM", label: "ATM BCA", x: 0.51, y: 0.615, kind: "entry" },
];

/** Pasangan node yang terhubung koridor. Bobot dihitung otomatis dari panjang segmen. */
export const edges: [string, string][] = [
  ["J-N1", "J-N2"],
  ["J-N2", "J-N3"],
  ["J-N3", "J-N-ELV"],
  ["J-N-ELV", "J-N4"],
  ["J-N4", "J-N5"],
  ["J-N5", "J-N6"],
  ["J-N1", "J-S1"],
  ["J-N2", "J-MID"],
  ["J-MID", "J-S2"],
  ["J-S1", "J-S2"],
  ["J-S2", "J-S-ELV"],
  ["J-S-ELV", "J-LOBBY"],
  ["J-N-ELV", "J-ELV"],
  ["J-ELV", "J-S-ELV"],
  ["J-LOBBY", "J-S5"],
  ["J-LOBBY", "E-LOBBY"],
  ["J-LOBBY", "E-LKC"],
  ["J-N1", "E-LAB"],
  ["J-N2", "E-AW"],
  ["J-N3", "E-IBOX"],
  ["J-N4", "E-WC"],
  ["J-N6", "E-SRSC"],
  ["J-S1", "E-MEGA"],
  ["J-S2", "E-BCA"],
  ["J-ELV", "E-ELEV"],
  ["J-N5", "E-ESC-N"],
  ["J-S5", "E-ESC-S"],
  ["J-S5", "E-ATM"],
];

type SeedLocation = {
  slug: string;
  name: string;
  shortName?: string;
  aliases?: string;
  type:
    | "entrance"
    | "library"
    | "service"
    | "retail"
    | "bank"
    | "vertical_access"
    | "office"
    | "room"
    | "toilet"
    | "food"
    | "other";
  description: string;
  markerX: number;
  markerY: number;
  entryNodeCode: string | null;
  routeNote?: string;
};

const AS_2020 = "Tercatat pada denah 2020; belum dicek apakah masih sama saat ini.";

export const locations: SeedLocation[] = [
  {
    slug: "lobby",
    name: "Lobby",
    aliases: "lobi,pintu masuk,entrance,depan",
    type: "entrance",
    description: `Area lobby lantai 1, titik awal yang umum untuk tamu dan mahasiswa baru. ${AS_2020}`,
    markerX: 0.46,
    markerY: 0.68,
    entryNodeCode: "E-LOBBY",
  },
  {
    slug: "lkc",
    name: "Library & Knowledge Center",
    shortName: "LKC",
    aliases: "library,perpustakaan,perpus,lkc,knowledge center",
    type: "library",
    description: `Perpustakaan kampus. ${AS_2020} Jam layanan belum diverifikasi.`,
    markerX: 0.47,
    markerY: 0.47,
    entryNodeCode: "E-LKC",
  },
  {
    slug: "srsc",
    name: "SRSC / Student Service Center",
    shortName: "SRSC",
    aliases: "student service,layanan mahasiswa,srsc,ssc",
    type: "service",
    description: `Pusat layanan mahasiswa. ${AS_2020}`,
    markerX: 0.6,
    markerY: 0.215,
    entryNodeCode: "E-SRSC",
  },
  {
    slug: "binus-megastore",
    name: "BINUS Megastore",
    shortName: "Megastore",
    aliases: "toko,store,merchandise,megastore",
    type: "retail",
    description: `Toko kampus. ${AS_2020}`,
    markerX: 0.075,
    markerY: 0.7,
    entryNodeCode: "E-MEGA",
  },
  {
    slug: "bca",
    name: "BCA",
    aliases: "bank,bca,kantor bank",
    type: "bank",
    description: `Layanan perbankan BCA. ${AS_2020}`,
    markerX: 0.255,
    markerY: 0.7,
    entryNodeCode: "E-BCA",
  },
  {
    slug: "atm-bca",
    name: "ATM BCA",
    aliases: "atm,tarik tunai,bca",
    type: "bank",
    description: `ATM BCA di dekat eskalator sisi selatan. ${AS_2020}`,
    markerX: 0.6,
    markerY: 0.615,
    entryNodeCode: "E-ATM",
  },
  {
    slug: "lab-restoran",
    name: "Lab. Restoran Hotel Management",
    shortName: "Lab. Restoran",
    aliases: "lab restoran,hotel management,laboratorium,restoran",
    type: "room",
    description: `Laboratorium restoran program Hotel Management. ${AS_2020}`,
    markerX: 0.07,
    markerY: 0.245,
    entryNodeCode: "E-LAB",
  },
  {
    slug: "a-and-w",
    name: "A&W",
    aliases: "aw,a&w,makan,restoran cepat saji,food",
    type: "food",
    description: `Gerai makanan. ${AS_2020} Tenant bisa saja sudah berganti.`,
    markerX: 0.255,
    markerY: 0.275,
    entryNodeCode: "E-AW",
  },
  {
    slug: "ibox",
    name: "iBOX",
    aliases: "ibox,apple,toko gadget",
    type: "retail",
    description: `Gerai iBOX. ${AS_2020} Tenant bisa saja sudah berganti.`,
    markerX: 0.32,
    markerY: 0.22,
    entryNodeCode: "E-IBOX",
  },
  {
    slug: "toilet",
    name: "Toilet",
    shortName: "WC",
    aliases: "wc,toilet,kamar mandi,restroom",
    type: "toilet",
    description: `Toilet di sisi utara, dekat iBOX. ${AS_2020}`,
    markerX: 0.4,
    markerY: 0.23,
    entryNodeCode: "E-WC",
  },
  {
    slug: "elevator",
    name: "Elevator",
    shortName: "Lift",
    aliases: "lift,elevator",
    type: "vertical_access",
    description: `Akses ke lantai lain. ${AS_2020} Status operasional real-time tidak tersedia; navigasi lintas lantai belum didukung.`,
    markerX: 0.335,
    markerY: 0.43,
    entryNodeCode: "E-ELEV",
  },
  {
    slug: "eskalator-utara",
    name: "Eskalator utara",
    aliases: "escalator,eskalator,tangga berjalan",
    type: "vertical_access",
    description: `Eskalator di sisi utara LKC, dekat SRSC. ${AS_2020} Navigasi lintas lantai belum didukung.`,
    markerX: 0.57,
    markerY: 0.377,
    entryNodeCode: "E-ESC-N",
  },
  {
    slug: "eskalator-selatan",
    name: "Eskalator selatan",
    aliases: "escalator,eskalator,tangga berjalan",
    type: "vertical_access",
    description: `Eskalator di sisi selatan LKC, dekat ATM BCA. ${AS_2020} Navigasi lintas lantai belum didukung.`,
    markerX: 0.57,
    markerY: 0.586,
    entryNodeCode: "E-ESC-S",
  },
  {
    slug: "admisi",
    name: "Admisi",
    aliases: "admisi,admission,pendaftaran,penerimaan mahasiswa baru,pmb",
    type: "office",
    description:
      "Layanan admisi (penerimaan mahasiswa baru) menurut denah 2020. Berada di gedung terpisah (area abu-abu pada denah).",
    markerX: 0.86,
    markerY: 0.4,
    entryNodeCode: null,
    routeNote: "Admisi berada di gedung terpisah. Rute antargedung belum didukung.",
  },
  {
    slug: "ruang-tanpa-label",
    name: "Ruang tanpa label",
    aliases: "ruang lain,belum diketahui",
    type: "room",
    description:
      "Ruang di sebelah selatan ATM BCA yang tidak berlabel pada denah 2020. Fungsinya belum diketahui; bantu laporkan bila kamu tahu.",
    markerX: 0.585,
    markerY: 0.705,
    entryNodeCode: null,
    routeNote: "Pintu ruang ini belum diketahui, jadi rutenya belum dibuat.",
  },
];
