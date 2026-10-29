import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  real,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enum                                                                */
/* ------------------------------------------------------------------ */

/** Status verifikasi sebuah data (lokasi, node, edge). */
export const verificationStatus = pgEnum("verification_status", [
  "unverified",
  "verified",
  "outdated",
]);

/** Asal data: dari denah referensi, dicek langsung di lapangan, atau simulasi demo. */
export const sourceType = pgEnum("source_type", [
  "reference_map",
  "field_verified",
  "demo_simulation",
]);

export const locationType = pgEnum("location_type", [
  "entrance",
  "library",
  "service",
  "retail",
  "bank",
  "vertical_access",
  "office",
  "room",
  "toilet",
  "food",
  "other",
]);

export const nodeKind = pgEnum("node_kind", ["junction", "corridor", "entry"]);

export const reportCategory = pgEnum("report_category", [
  "wrong_name",
  "moved",
  "facility_changed",
  "other",
]);

export const reportStatus = pgEnum("report_status", [
  "pending",
  "approved",
  "rejected",
]);

/* ------------------------------------------------------------------ */
/* Tabel                                                               */
/* ------------------------------------------------------------------ */

export const buildings = pgTable("buildings", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  campus: varchar("campus", { length: 160 }),
});

export const floors = pgTable(
  "floors",
  {
    id: serial("id").primaryKey(),
    buildingId: integer("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    /** Path aset denah di /public, null bila denah referensi belum dipasang. */
    mapAsset: varchar("map_asset", { length: 255 }),
    /** Ukuran kanvas (piksel gambar referensi) untuk menjaga rasio. */
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** Label singkat sumber denah, mis. "Denah referensi 2020". */
    mapSourceLabel: varchar("map_source_label", { length: 160 }),
    mapSourceNote: text("map_source_note"),
    mapVerificationStatus: verificationStatus("map_verification_status")
      .notNull()
      .default("unverified"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("floors_building_number_idx").on(t.buildingId, t.number)],
);

export const routeNodes = pgTable(
  "route_nodes",
  {
    id: serial("id").primaryKey(),
    floorId: integer("floor_id")
      .notNull()
      .references(() => floors.id, { onDelete: "cascade" }),
    /** Kode stabil untuk seed/sinkronisasi, mis. "J-LOBBY". */
    code: varchar("code", { length: 60 }).notNull().unique(),
    /** Label penanda arah opsional, dipakai di instruksi teks. */
    label: varchar("label", { length: 160 }),
    /** Koordinat relatif 0–1 terhadap kanvas denah (bukan GPS). */
    x: real("x").notNull(),
    y: real("y").notNull(),
    kind: nodeKind("kind").notNull().default("junction"),
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("unverified"),
    sourceType: sourceType("source_type").notNull().default("demo_simulation"),
  },
  (t) => [index("route_nodes_floor_idx").on(t.floorId)],
);

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    floorId: integer("floor_id")
      .notNull()
      .references(() => floors.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    shortName: varchar("short_name", { length: 40 }),
    /** Kata kunci tambahan untuk pencarian (dipisah koma). */
    aliases: text("aliases"),
    type: locationType("type").notNull().default("other"),
    description: text("description"),
    /** Posisi penanda UI (relatif 0–1). Berbeda dari titik masuk untuk rute. */
    markerX: real("marker_x").notNull(),
    markerY: real("marker_y").notNull(),
    /** Titik masuk ruangan pada graph rute; null = belum bisa dirutekan. */
    entryNodeId: integer("entry_node_id").references(() => routeNodes.id, {
      onDelete: "set null",
    }),
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("unverified"),
    sourceType: sourceType("source_type").notNull().default("reference_map"),
    /** Alasan rute tidak tersedia (mis. berada di gedung terpisah). */
    routeNote: text("route_note"),
    /** True bila ada perubahan yang membuat rute ke lokasi ini perlu dicek ulang. */
    needsRouteReview: boolean("needs_route_review").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("locations_floor_idx").on(t.floorId)],
);

export const routeEdges = pgTable(
  "route_edges",
  {
    id: serial("id").primaryKey(),
    floorId: integer("floor_id")
      .notNull()
      .references(() => floors.id, { onDelete: "cascade" }),
    fromNodeId: integer("from_node_id")
      .notNull()
      .references(() => routeNodes.id, { onDelete: "cascade" }),
    toNodeId: integer("to_node_id")
      .notNull()
      .references(() => routeNodes.id, { onDelete: "cascade" }),
    /** Bobot dalam satuan peta relatif (map_units), bukan meter. */
    cost: real("cost").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("unverified"),
    sourceType: sourceType("source_type").notNull().default("demo_simulation"),
  },
  (t) => [
    uniqueIndex("route_edges_pair_idx").on(t.fromNodeId, t.toNodeId),
    index("route_edges_floor_idx").on(t.floorId),
  ],
);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    /** Boleh null: pengguna bisa melaporkan ruang yang belum ada di data. */
    locationId: integer("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    category: reportCategory("category").notNull(),
    description: text("description").notNull(),
    suggestedName: varchar("suggested_name", { length: 160 }),
    status: reportStatus("status").notNull().default("pending"),
    /** Hash IP (bukan IP mentah) untuk pembatasan spam. */
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: integer("reviewed_by").references(() => admins.id, {
      onDelete: "set null",
    }),
    adminNote: text("admin_note"),
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

/** Jejak audit setiap perubahan yang dilakukan admin. */
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
  action: varchar("action", { length: 60 }).notNull(),
  entity: varchar("entity", { length: 40 }).notNull(),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Pembatas laju berbasis database agar tetap berlaku di lingkungan serverless. */
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 120 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

/** Penyimpanan metadata aplikasi, mis. versi data seed. */
export const appMeta = pgTable("app_meta", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: text("value").notNull(),
});

export type Location = typeof locations.$inferSelect;
export type RouteNode = typeof routeNodes.$inferSelect;
export type RouteEdge = typeof routeEdges.$inferSelect;
export type Report = typeof reports.$inferSelect;
