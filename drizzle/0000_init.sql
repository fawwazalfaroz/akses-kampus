CREATE TYPE "public"."location_type" AS ENUM('entrance', 'library', 'service', 'retail', 'bank', 'vertical_access', 'office', 'room', 'other');--> statement-breakpoint
CREATE TYPE "public"."node_kind" AS ENUM('junction', 'corridor', 'entry');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('wrong_name', 'moved', 'facility_changed', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('reference_map', 'field_verified', 'demo_simulation');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'verified', 'outdated');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(160) NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "app_meta" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"action" varchar(60) NOT NULL,
	"entity" varchar(40) NOT NULL,
	"entity_id" integer,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"campus" varchar(160),
	CONSTRAINT "buildings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "floors" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer NOT NULL,
	"number" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"map_asset" varchar(255),
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"map_source_note" text,
	"map_verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"floor_id" integer NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"short_name" varchar(40),
	"aliases" text,
	"type" "location_type" DEFAULT 'other' NOT NULL,
	"description" text,
	"marker_x" real NOT NULL,
	"marker_y" real NOT NULL,
	"entry_node_id" integer,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"source_type" "source_type" DEFAULT 'reference_map' NOT NULL,
	"needs_route_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer,
	"category" "report_category" NOT NULL,
	"description" text NOT NULL,
	"suggested_name" varchar(160),
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer,
	"admin_note" text
);
--> statement-breakpoint
CREATE TABLE "route_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"floor_id" integer NOT NULL,
	"from_node_id" integer NOT NULL,
	"to_node_id" integer NOT NULL,
	"cost" real NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"source_type" "source_type" DEFAULT 'demo_simulation' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"floor_id" integer NOT NULL,
	"code" varchar(60) NOT NULL,
	"label" varchar(160),
	"x" real NOT NULL,
	"y" real NOT NULL,
	"kind" "node_kind" DEFAULT 'junction' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"source_type" "source_type" DEFAULT 'demo_simulation' NOT NULL,
	CONSTRAINT "route_nodes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_entry_node_id_route_nodes_id_fk" FOREIGN KEY ("entry_node_id") REFERENCES "public"."route_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_edges" ADD CONSTRAINT "route_edges_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_edges" ADD CONSTRAINT "route_edges_from_node_id_route_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."route_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_edges" ADD CONSTRAINT "route_edges_to_node_id_route_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."route_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_nodes" ADD CONSTRAINT "route_nodes_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "floors_building_number_idx" ON "floors" USING btree ("building_id","number");--> statement-breakpoint
CREATE INDEX "locations_floor_idx" ON "locations" USING btree ("floor_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "route_edges_pair_idx" ON "route_edges" USING btree ("from_node_id","to_node_id");--> statement-breakpoint
CREATE INDEX "route_edges_floor_idx" ON "route_edges" USING btree ("floor_id");--> statement-breakpoint
CREATE INDEX "route_nodes_floor_idx" ON "route_nodes" USING btree ("floor_id");