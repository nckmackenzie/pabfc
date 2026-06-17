CREATE TYPE "public"."overtime_status" AS ENUM('draft', 'approved', 'paid');--> statement-breakpoint
CREATE TABLE "overtime_records" (
	"id" varchar PRIMARY KEY NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"payroll_period_id" varchar(255),
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"weekday_overtime_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"weekend_overtime_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"public_holiday_overtime_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"overtime_hourly_rate" numeric(14, 2) DEFAULT '0' NOT NULL,
	"weekday_overtime_pay" numeric(14, 2) DEFAULT '0' NOT NULL,
	"weekend_overtime_pay" numeric(14, 2) DEFAULT '0' NOT NULL,
	"public_holiday_overtime_pay" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_overtime_pay" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "overtime_status" DEFAULT 'draft' NOT NULL,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"payroll_slip_id" varchar(255),
	"notes" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overtime_records_period_month_range" CHECK ("overtime_records"."period_month" >= 1 and "overtime_records"."period_month" <= 12),
	CONSTRAINT "overtime_records_period_year_range" CHECK ("overtime_records"."period_year" >= 2000 and "overtime_records"."period_year" <= 2100)
);
--> statement-breakpoint
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_overtime_records_employee_period" ON "overtime_records" USING btree ("employee_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_overtime_records_period_status" ON "overtime_records" USING btree ("period_year","period_month","status");--> statement-breakpoint
CREATE INDEX "idx_overtime_records_payroll_slip_id" ON "overtime_records" USING btree ("payroll_slip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_overtime_records_employee_period" ON "overtime_records" USING btree ("employee_id","period_year","period_month");