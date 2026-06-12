CREATE TYPE "public"."biotime_person_type" AS ENUM('member', 'employee');--> statement-breakpoint
ALTER TYPE "public"."access_sync_action" ADD VALUE 'RESIGN_EMPLOYEE';--> statement-breakpoint
ALTER TYPE "public"."access_sync_action" ADD VALUE 'REINSTATE_EMPLOYEE';--> statement-breakpoint
CREATE TABLE "biotime_person_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_type" "biotime_person_type" NOT NULL,
	"member_id" varchar,
	"employee_id" varchar,
	"biotime_employee_id" integer,
	"biotime_employee_code" varchar(50) NOT NULL,
	"biotime_department_id" integer NOT NULL,
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
CREATE TABLE "employee_attendance_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"employee_id" varchar NOT NULL,
	"check_in_time" timestamp with time zone NOT NULL,
	"check_out_time" timestamp with time zone,
	"source" varchar(30) DEFAULT 'biotime',
	"device_id" varchar(100),
	"notes" text,
	"biotime_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "employee_attendance_logs_biotime_id_unique" UNIQUE("biotime_id")
);
--> statement-breakpoint
ALTER TABLE "access_control_sync_jobs" ALTER COLUMN "member_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "access_control_sync_jobs" ADD COLUMN "biotime_person_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "access_control_sync_jobs" ADD COLUMN "person_type" "biotime_person_type" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "access_control_sync_jobs" ADD COLUMN "employee_id" varchar;--> statement-breakpoint
ALTER TABLE "biotime_person_profiles" ADD CONSTRAINT "biotime_person_profiles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biotime_person_profiles" ADD CONSTRAINT "biotime_person_profiles_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_attendance_logs" ADD CONSTRAINT "employee_attendance_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_biotime_person_profiles_emp_code" ON "biotime_person_profiles" USING btree ("biotime_employee_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_biotime_person_profiles_biotime_id" ON "biotime_person_profiles" USING btree ("biotime_employee_id");--> statement-breakpoint
CREATE INDEX "idx_biotime_person_profiles_type" ON "biotime_person_profiles" USING btree ("person_type");--> statement-breakpoint
CREATE INDEX "idx_biotime_person_profiles_member" ON "biotime_person_profiles" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_biotime_person_profiles_employee" ON "biotime_person_profiles" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_biotime_person_profiles_status" ON "biotime_person_profiles" USING btree ("access_control_status");--> statement-breakpoint
ALTER TABLE "access_control_sync_jobs" ADD CONSTRAINT "access_control_sync_jobs_biotime_person_profile_id_biotime_person_profiles_id_fk" FOREIGN KEY ("biotime_person_profile_id") REFERENCES "public"."biotime_person_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_control_sync_jobs" ADD CONSTRAINT "access_control_sync_jobs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;