CREATE TYPE "public"."payroll_remittance_item_type" AS ENUM('paye', 'nssf', 'shif', 'ahl', 'nita', 'helb');--> statement-breakpoint
CREATE TABLE "payroll_remittance_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_entry_id" integer NOT NULL,
	"payroll_period_id" varchar(255) NOT NULL,
	"remittance_type" "payroll_remittance_item_type" NOT NULL,
	"amount_remitted" numeric(14, 2) NOT NULL,
	"reference_number" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_remittance_line_items" ADD CONSTRAINT "payroll_remittance_line_items_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_remittance_line_items" ADD CONSTRAINT "payroll_remittance_line_items_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payroll_remittance_line_items_period_type" ON "payroll_remittance_line_items" USING btree ("payroll_period_id","remittance_type");--> statement-breakpoint
CREATE INDEX "idx_payroll_remittance_line_items_journal_entry" ON "payroll_remittance_line_items" USING btree ("journal_entry_id");