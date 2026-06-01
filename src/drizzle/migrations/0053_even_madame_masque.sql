CREATE TYPE "public"."access_control_status" AS ENUM('not_synced', 'pending_sync', 'pending_biometric_enrollment', 'active', 'disabled', 'frozen', 'sync_failed');--> statement-breakpoint
CREATE TYPE "public"."access_sync_action" AS ENUM('CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE', 'ENABLE_ACCESS', 'DISABLE_ACCESS', 'FULL_RECONCILE');--> statement-breakpoint
CREATE TYPE "public"."access_sync_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."biometric_enrollment_status" AS ENUM('not_required', 'pending', 'face_enrolled', 'fingerprint_enrolled', 'face_and_fingerprint_enrolled', 'unknown');--> statement-breakpoint
CREATE TABLE "access_control_sync_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"success" boolean NOT NULL,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_control_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"action" "access_sync_action" NOT NULL,
	"status" "access_sync_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 10 NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_access_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"biotime_employee_id" integer,
	"biotime_employee_code" varchar(50) NOT NULL,
	"biotime_department_id" integer DEFAULT 1 NOT NULL,
	"authorized_area_id" integer DEFAULT 2 NOT NULL,
	"unauthorized_area_id" integer DEFAULT 1 NOT NULL,
	"current_area_id" integer,
	"desired_access_enabled" boolean DEFAULT false NOT NULL,
	"access_control_status" "access_control_status" DEFAULT 'not_synced' NOT NULL,
	"biometric_enrollment_status" "biometric_enrollment_status" DEFAULT 'pending' NOT NULL,
	"face_enrolled" boolean DEFAULT false NOT NULL,
	"fingerprint_enrolled" boolean DEFAULT false NOT NULL,
	"biotime_resign_id" integer,
	"last_synced_at" timestamp with time zone,
	"last_sync_attempt_at" timestamp with time zone,
	"last_sync_error" text,
	"last_sync_payload" jsonb,
	"last_sync_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_control_sync_attempts" ADD CONSTRAINT "access_control_sync_attempts_job_id_access_control_sync_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."access_control_sync_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control_sync_jobs" ADD CONSTRAINT "access_control_sync_jobs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_access_profiles" ADD CONSTRAINT "member_access_profiles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_sync_attempts_job" ON "access_control_sync_attempts" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_access_sync_jobs_idempotency" ON "access_control_sync_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_access_sync_jobs_status" ON "access_control_sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_access_sync_jobs_member" ON "access_control_sync_jobs" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_access_profiles_member" ON "member_access_profiles" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_access_profiles_biotime_employee_code" ON "member_access_profiles" USING btree ("biotime_employee_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_access_profiles_biotime_employee_id" ON "member_access_profiles" USING btree ("biotime_employee_id");--> statement-breakpoint
CREATE INDEX "idx_member_access_profiles_status" ON "member_access_profiles" USING btree ("access_control_status");