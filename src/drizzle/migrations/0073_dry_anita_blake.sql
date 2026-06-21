ALTER TYPE "public"."payroll_account_role" ADD VALUE IF NOT EXISTS 'salary_advance_receivable';--> statement-breakpoint
CREATE TYPE "public"."salary_advance_status" AS ENUM('pending', 'approved', 'disbursed', 'recovering', 'fully_recovered', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "salary_advance_recoveries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"advance_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"recovery_date" date NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"recovery_amount" numeric(14, 2) NOT NULL,
	"balance_before" numeric(14, 2) NOT NULL,
	"balance_after" numeric(14, 2) NOT NULL,
	"is_last_recovery" boolean DEFAULT false NOT NULL,
	"payroll_slip_id" varchar(255),
	"clearing_journal_entry_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salary_advance_recoveries_period_month_range" CHECK ("salary_advance_recoveries"."period_month" >= 1 and "salary_advance_recoveries"."period_month" <= 12),
	CONSTRAINT "salary_advance_recoveries_period_year_range" CHECK ("salary_advance_recoveries"."period_year" >= 2020 and "salary_advance_recoveries"."period_year" <= 2100)
);
--> statement-breakpoint
CREATE TABLE "salary_advances" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"application_date" date DEFAULT CURRENT_DATE NOT NULL,
	"requested_amount" numeric(14, 2) NOT NULL,
	"reason" text,
	"status" "salary_advance_status" DEFAULT 'pending' NOT NULL,
	"requested_recovery_months" integer DEFAULT 1 NOT NULL,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"approved_amount" numeric(14, 2),
	"approved_recovery_months" integer,
	"monthly_recovery_amount" numeric(14, 2),
	"disbursement_account_id" integer,
	"disbursement_date" date,
	"disbursement_journal_entry_id" integer,
	"recovery_start_month" integer,
	"recovery_start_year" integer,
	"rejected_by" varchar(255),
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"cancelled_by" varchar(255),
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"outstanding_balance" numeric(14, 2),
	"total_recovered" numeric(14, 2) DEFAULT '0' NOT NULL,
	"recoveries_processed" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salary_advances_requested_recovery_months_range" CHECK ("salary_advances"."requested_recovery_months" >= 1 and "salary_advances"."requested_recovery_months" <= 3),
	CONSTRAINT "salary_advances_approved_recovery_months_range" CHECK ("salary_advances"."approved_recovery_months" is null or ("salary_advances"."approved_recovery_months" >= 1 and "salary_advances"."approved_recovery_months" <= 3)),
	CONSTRAINT "salary_advances_recovery_start_month_range" CHECK ("salary_advances"."recovery_start_month" is null or ("salary_advances"."recovery_start_month" >= 1 and "salary_advances"."recovery_start_month" <= 12)),
	CONSTRAINT "salary_advances_recovery_start_year_range" CHECK ("salary_advances"."recovery_start_year" is null or ("salary_advances"."recovery_start_year" >= 2020 and "salary_advances"."recovery_start_year" <= 2100))
);
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "total_advance_recoveries" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "total_pension_employer" numeric(14, 2);--> statement-breakpoint
INSERT INTO "ledger_accounts" (
	"code",
	"name",
	"type",
	"normal_balance",
	"parent_id",
	"is_posting",
	"is_active",
	"description",
	"created_at",
	"updated_at"
)
VALUES (
	'1151',
	'Salary Advance Receivable',
	'asset',
	'debit',
	(SELECT "id" FROM "ledger_accounts" WHERE "code" = '1091'),
	true,
	true,
	'Salary advances disbursed to employees pending recovery through payroll',
	now(),
	now()
)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "payroll_account_mappings" (
	"role",
	"account_id",
	"description",
	"created_at",
	"updated_at"
)
SELECT
	'salary_advance_receivable',
	"ledger_accounts"."id",
	'Debited when a salary advance is disbursed to an employee; credited when the advance is recovered through payroll deductions. This is an asset account.',
	now(),
	now()
FROM "ledger_accounts"
WHERE "ledger_accounts"."code" = '1151'
ON CONFLICT ("role") DO NOTHING;--> statement-breakpoint
ALTER TABLE "salary_advance_recoveries" ADD CONSTRAINT "salary_advance_recoveries_advance_id_salary_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advance_recoveries" ADD CONSTRAINT "salary_advance_recoveries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advance_recoveries" ADD CONSTRAINT "salary_advance_recoveries_clearing_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("clearing_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_disbursement_account_id_ledger_accounts_id_fk" FOREIGN KEY ("disbursement_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_disbursement_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("disbursement_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_salary_advance_recoveries_advance_id" ON "salary_advance_recoveries" USING btree ("advance_id");--> statement-breakpoint
CREATE INDEX "idx_salary_advance_recoveries_employee_period" ON "salary_advance_recoveries" USING btree ("employee_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_salary_advance_recoveries_payroll_slip_id" ON "salary_advance_recoveries" USING btree ("payroll_slip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_salary_advance_recoveries_advance_period" ON "salary_advance_recoveries" USING btree ("advance_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_salary_advances_employee_id" ON "salary_advances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_salary_advances_employee_status" ON "salary_advances" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "idx_salary_advances_disbursement_account_id" ON "salary_advances" USING btree ("disbursement_account_id");--> statement-breakpoint
CREATE INDEX "idx_salary_advances_status" ON "salary_advances" USING btree ("status");
