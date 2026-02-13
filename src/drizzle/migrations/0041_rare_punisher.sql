CREATE TABLE "bank_accounts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"bank_name" varchar(255) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_postings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"transaction_date" date NOT NULL,
	"bank_id" varchar NOT NULL,
	"dc" "line_dc" NOT NULL,
	"amount" integer NOT NULL,
	"reference" varchar(255) NOT NULL,
	"cleared" boolean DEFAULT false,
	"cleared_at" date,
	"narration" varchar(255),
	"source_type" varchar(50),
	"source_id" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_postings" ADD CONSTRAINT "bank_postings_bank_id_bank_accounts_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_accounts_bank_name_idx" ON "bank_accounts" USING btree ("bank_name");--> statement-breakpoint
CREATE INDEX "bank_accounts_account_number_idx" ON "bank_accounts" USING btree ("account_number");--> statement-breakpoint
CREATE INDEX "bank_postings_bank_id_idx" ON "bank_postings" USING btree ("bank_id");--> statement-breakpoint
CREATE INDEX "bank_postings_transaction_date_idx" ON "bank_postings" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "bank_postings_reference_idx" ON "bank_postings" USING btree ("reference");