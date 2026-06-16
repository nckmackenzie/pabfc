CREATE TYPE "public"."payroll_account_role" AS ENUM('salaries_expense', 'overtime_expense', 'bonus_expense', 'nssf_employer_expense', 'shif_employer_expense', 'ahl_employer_expense', 'nita_expense', 'pension_employer_expense', 'paye_payable', 'nssf_payable', 'shif_payable', 'ahl_payable', 'nita_payable', 'helb_payable', 'loan_deductions_payable', 'other_deductions_payable', 'net_salaries_payable', 'salary_advance_payable');--> statement-breakpoint
CREATE TABLE "payroll_account_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "payroll_account_role" NOT NULL,
	"account_id" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_account_mappings_role_unique" UNIQUE("role")
);
--> statement-breakpoint
ALTER TABLE "payroll_account_mappings" ADD CONSTRAINT "payroll_account_mappings_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payroll_account_mappings_role" ON "payroll_account_mappings" USING btree ("role");