ALTER TABLE "employee_attendance_logs" RENAME TO "employee_gym_access_logs";--> statement-breakpoint
ALTER TABLE "employee_gym_access_logs" RENAME COLUMN "check_in_time" TO "punch_time";--> statement-breakpoint
ALTER TABLE "employee_gym_access_logs" DROP CONSTRAINT "employee_attendance_logs_biotime_id_unique";--> statement-breakpoint
ALTER TABLE "employee_gym_access_logs" DROP CONSTRAINT "employee_attendance_logs_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "employee_gym_access_logs" ADD CONSTRAINT "employee_gym_access_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_gym_access_logs" DROP COLUMN "check_out_time";--> statement-breakpoint
ALTER TABLE "employee_gym_access_logs" ADD CONSTRAINT "employee_gym_access_logs_biotime_id_unique" UNIQUE("biotime_id");