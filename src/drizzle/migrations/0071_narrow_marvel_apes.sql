CREATE TYPE "public"."payroll_period_status" AS ENUM('draft', 'processing', 'approved', 'paid', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"status" "payroll_period_status" DEFAULT 'draft' NOT NULL,
	"total_gross_pay" numeric(14, 2),
	"total_net_pay" numeric(14, 2),
	"total_paye" numeric(14, 2),
	"total_nssf_employee" numeric(14, 2),
	"total_nssf_employer" numeric(14, 2),
	"total_shif_employee" numeric(14, 2),
	"total_shif_employer" numeric(14, 2),
	"total_ahl_employee" numeric(14, 2),
	"total_ahl_employer" numeric(14, 2),
	"total_nita" numeric(14, 2),
	"total_loan_deductions" numeric(14, 2),
	"total_other_deductions" numeric(14, 2),
	"employee_count" integer,
	"processing_started_at" timestamp with time zone,
	"processing_completed_at" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancelled_by" varchar(255),
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"disbursement_journal_entry_id" integer,
	"remittance_journal_entry_id" integer,
	"payroll_journal_entry_id" integer,
	"notes" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_periods_period_month_range" CHECK ("payroll_periods"."period_month" >= 1 and "payroll_periods"."period_month" <= 12),
	CONSTRAINT "payroll_periods_period_year_range" CHECK ("payroll_periods"."period_year" >= 2020 and "payroll_periods"."period_year" <= 2100),
	CONSTRAINT "payroll_periods_period_dates_order" CHECK ("payroll_periods"."period_end" >= "payroll_periods"."period_start")
);
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_disbursement_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("disbursement_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_remittance_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("remittance_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_payroll_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("payroll_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payroll_periods_month_year_active" ON "payroll_periods" USING btree ("period_month","period_year") WHERE "payroll_periods"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "idx_payroll_periods_status" ON "payroll_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_periods_pay_date" ON "payroll_periods" USING btree ("pay_date");--> statement-breakpoint
CREATE INDEX "idx_payroll_periods_year" ON "payroll_periods" USING btree ("period_year");--> statement-breakpoint
ALTER TABLE "overtime_records" ADD CONSTRAINT "fk_overtime_payroll_period" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE set null ON UPDATE no action;
