CREATE TYPE "public"."wht_category" AS ENUM('professional_management_training_fee', 'rent', 'contractual_fee', 'other');--> statement-breakpoint
CREATE TABLE "wht_remittance_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_number" integer NOT NULL,
	"remittance_id" varchar NOT NULL,
	"bill_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"current_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"dc" "line_dc" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wht_remittances" (
	"id" varchar PRIMARY KEY NOT NULL,
	"remittance_no" integer NOT NULL,
	"remittance_date" date NOT NULL,
	"reference" varchar,
	"bank_id" varchar,
	"crediting_account_id" integer,
	"memo" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "wht_applicable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "wht_category" "wht_category";--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "wht_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "wht_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "wht_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "wht_certificate_no" varchar;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "wht_certificate_issued_date" date;--> statement-breakpoint
ALTER TABLE "wht_remittance_lines" ADD CONSTRAINT "wht_remittance_lines_remittance_id_wht_remittances_id_fk" FOREIGN KEY ("remittance_id") REFERENCES "public"."wht_remittances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_remittance_lines" ADD CONSTRAINT "wht_remittance_lines_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_remittances" ADD CONSTRAINT "wht_remittances_bank_id_bank_accounts_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_remittances" ADD CONSTRAINT "wht_remittances_crediting_account_id_ledger_accounts_id_fk" FOREIGN KEY ("crediting_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_remittances" ADD CONSTRAINT "wht_remittances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_wht_remittance_lines_remittance_id" ON "wht_remittance_lines" USING btree ("remittance_id");--> statement-breakpoint
CREATE INDEX "idx_wht_remittance_lines_bill_id" ON "wht_remittance_lines" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "idx_wht_remittance_lines_bill_id_dc" ON "wht_remittance_lines" USING btree ("bill_id","dc");--> statement-breakpoint
CREATE INDEX "idx_wht_remittances_remittance_no" ON "wht_remittances" USING btree ("remittance_no");--> statement-breakpoint
CREATE INDEX "idx_wht_remittances_remittance_date" ON "wht_remittances" USING btree ("remittance_date");--> statement-breakpoint
CREATE INDEX "idx_wht_remittances_reference" ON "wht_remittances" USING btree ("reference");