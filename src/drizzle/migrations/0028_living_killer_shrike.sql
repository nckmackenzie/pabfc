CREATE TYPE "public"."expense_payment_method" AS ENUM('cash', 'cheque', 'mpesa', 'bank');--> statement-breakpoint
CREATE TABLE "expense_details" (
	"id" varchar PRIMARY KEY NOT NULL,
	"expense_header_id" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"account_id" integer NOT NULL,
	"quantity" numeric(18, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"line_subtotal" numeric(18, 2) NOT NULL,
	"vat_type" "vat_type" DEFAULT 'none' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 2) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_headers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"expense_date" date NOT NULL,
	"expense_no" integer NOT NULL,
	"payee_id" varchar NOT NULL,
	"payment_method" "expense_payment_method" NOT NULL,
	"reference" varchar(50),
	"sub_total" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'KES' NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payees" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_details" ADD CONSTRAINT "expense_details_expense_header_id_expense_headers_id_fk" FOREIGN KEY ("expense_header_id") REFERENCES "public"."expense_headers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_details" ADD CONSTRAINT "expense_details_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_headers" ADD CONSTRAINT "expense_headers_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_headers" ADD CONSTRAINT "expense_headers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_expense_no_idx" ON "expense_headers" USING btree ("expense_no");--> statement-breakpoint
CREATE INDEX "expenses_reference_idx" ON "expense_headers" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "expense_expense_date_idx" ON "expense_headers" USING btree ("expense_date");