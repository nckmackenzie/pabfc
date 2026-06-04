CREATE TABLE "biotime_attendance_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_successful_sync_at" timestamp with time zone,
	"last_attempted_sync_at" timestamp with time zone,
	"last_fetched_start_time" timestamp with time zone,
	"last_fetched_end_time" timestamp with time zone,
	"last_inserted_count" integer DEFAULT 0 NOT NULL,
	"last_skipped_duplicate_count" integer DEFAULT 0 NOT NULL,
	"last_unmapped_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biotime_unmapped_attendance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"biotime_id" integer NOT NULL,
	"emp_code" varchar(50) NOT NULL,
	"punch_time" timestamp with time zone NOT NULL,
	"punch_state" varchar(10),
	"punch_state_display" varchar(50),
	"terminal_sn" varchar(100),
	"raw_payload" jsonb,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_biotime_unmapped_attendance_biotime_id" ON "biotime_unmapped_attendance_transactions" USING btree ("biotime_id");--> statement-breakpoint
CREATE INDEX "idx_biotime_unmapped_attendance_emp_code" ON "biotime_unmapped_attendance_transactions" USING btree ("emp_code");--> statement-breakpoint
CREATE INDEX "idx_biotime_unmapped_attendance_resolved" ON "biotime_unmapped_attendance_transactions" USING btree ("resolved");