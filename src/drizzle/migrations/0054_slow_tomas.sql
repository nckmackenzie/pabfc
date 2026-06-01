CREATE TABLE "biotime_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_url" varchar(255) DEFAULT 'http://127.0.0.1/' NOT NULL,
	"username" varchar(255),
	"password" text,
	"default_department_id" integer DEFAULT 1 NOT NULL,
	"authorized_area_id" integer DEFAULT 2 NOT NULL,
	"unauthorized_area_id" integer DEFAULT 1 NOT NULL,
	"device_serial_number" varchar(100),
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"poll_interval_seconds" integer DEFAULT 30 NOT NULL,
	"batch_size" integer DEFAULT 10 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_control_sync_jobs" ALTER COLUMN "member_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "member_access_profiles" ALTER COLUMN "member_id" SET DATA TYPE varchar;