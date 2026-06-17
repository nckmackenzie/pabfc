CREATE TYPE "public"."loan_status" AS ENUM('pending', 'active', 'paused', 'fully_paid', 'written_off', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."payroll_account_role" ADD VALUE 'loans_receivable' BEFORE 'paye_payable';--> statement-breakpoint
CREATE TABLE "employee_loans" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"application_date" date DEFAULT CURRENT_DATE NOT NULL,
	"principal_amount" numeric(14, 2) NOT NULL,
	"annual_interest_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"requested_instalments" integer NOT NULL,
	"purpose" text,
	"status" "loan_status" DEFAULT 'pending' NOT NULL,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"approved_amount" numeric(14, 2),
	"approved_instalments" integer,
	"disbursement_account_id" integer,
	"disbursement_date" date,
	"repayment_start_month" integer,
	"repayment_start_year" integer,
	"monthly_instalment" numeric(14, 2),
	"disbursement_journal_entry_id" integer,
	"rejected_by" varchar(255),
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"outstanding_balance" numeric(14, 2),
	"total_principal_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_interest_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"instalments_paid" integer DEFAULT 0 NOT NULL,
	"paused_by" varchar(255),
	"paused_at" timestamp with time zone,
	"resumed_by" varchar(255),
	"resumed_at" timestamp with time zone,
	"settled_date" date,
	"settlement_journal_entry_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_loans_requested_instalments_range" CHECK ("employee_loans"."requested_instalments" >= 1 and "employee_loans"."requested_instalments" <= 60),
	CONSTRAINT "employee_loans_approved_instalments_range" CHECK ("employee_loans"."approved_instalments" is null or ("employee_loans"."approved_instalments" >= 1 and "employee_loans"."approved_instalments" <= 60)),
	CONSTRAINT "employee_loans_interest_rate_range" CHECK ("employee_loans"."annual_interest_rate" >= 0 and "employee_loans"."annual_interest_rate" <= 1),
	CONSTRAINT "employee_loans_repayment_start_month_range" CHECK ("employee_loans"."repayment_start_month" is null or ("employee_loans"."repayment_start_month" >= 1 and "employee_loans"."repayment_start_month" <= 12)),
	CONSTRAINT "employee_loans_repayment_start_year_range" CHECK ("employee_loans"."repayment_start_year" is null or ("employee_loans"."repayment_start_year" >= 2000 and "employee_loans"."repayment_start_year" <= 2100))
);
--> statement-breakpoint
CREATE TABLE "loan_repayments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loan_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"repayment_date" date NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"principal_component" numeric(14, 2) NOT NULL,
	"interest_component" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_repayment" numeric(14, 2) NOT NULL,
	"balance_before" numeric(14, 2) NOT NULL,
	"balance_after" numeric(14, 2) NOT NULL,
	"is_early_settlement" boolean DEFAULT false NOT NULL,
	"payroll_slip_id" varchar(255),
	"journal_entry_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_repayments_period_month_range" CHECK ("loan_repayments"."period_month" >= 1 and "loan_repayments"."period_month" <= 12),
	CONSTRAINT "loan_repayments_period_year_range" CHECK ("loan_repayments"."period_year" >= 2000 and "loan_repayments"."period_year" <= 2100)
);
--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_disbursement_account_id_ledger_accounts_id_fk" FOREIGN KEY ("disbursement_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_disbursement_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("disbursement_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_paused_by_users_id_fk" FOREIGN KEY ("paused_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_resumed_by_users_id_fk" FOREIGN KEY ("resumed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_settlement_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("settlement_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_employee_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."employee_loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_loans_employee_id" ON "employee_loans" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_loans_employee_status" ON "employee_loans" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "idx_employee_loans_disbursement_account_id" ON "employee_loans" USING btree ("disbursement_account_id");--> statement-breakpoint
CREATE INDEX "idx_loan_repayments_loan_id" ON "loan_repayments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_loan_repayments_employee_period" ON "loan_repayments" USING btree ("employee_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_loan_repayments_payroll_slip_id" ON "loan_repayments" USING btree ("payroll_slip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_loan_repayments_period_non_early" ON "loan_repayments" USING btree ("loan_id","period_year","period_month") WHERE "is_early_settlement" = false;
