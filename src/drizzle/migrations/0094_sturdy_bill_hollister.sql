CREATE TYPE "public"."ledger_account_role" AS ENUM('accounts_payable', 'vat_input', 'wht_payable', 'opening_balance_equity');--> statement-breakpoint
CREATE TABLE "ledger_account_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "ledger_account_role" NOT NULL,
	"account_id" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_account_mappings_role_unique" UNIQUE("role")
);
--> statement-breakpoint
ALTER TABLE "ledger_account_mappings" ADD CONSTRAINT "ledger_account_mappings_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ledger_account_mappings_role" ON "ledger_account_mappings" USING btree ("role");