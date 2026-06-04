ALTER TABLE "attendance_logs" ADD COLUMN "biotime_id" integer;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_biotime_id_unique" UNIQUE("biotime_id");