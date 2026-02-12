CREATE TYPE "public"."bill_status" AS ENUM('draft', 'pending', 'approved', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recurrency_period" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'biannually', 'yearly');--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"expense_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_payment_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_number" integer NOT NULL,
	"bill_payment_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"bill_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"dc" "line_dc" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_payments" (
	"id" varchar PRIMARY KEY NOT NULL,
	"payment_no" integer NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method" varchar NOT NULL,
	"reference" varchar,
	"memo" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" varchar PRIMARY KEY NOT NULL,
	"vendor_id" varchar NOT NULL,
	"invoice_no" varchar NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"vat_type" "vat_type" DEFAULT 'exclusive' NOT NULL,
	"vat_rate" numeric(10, 2) DEFAULT '16' NOT NULL,
	"sub_total" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"status" "bill_status" DEFAULT 'draft' NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrency_period" "recurrency_period",
	"recurrency_end_date" date,
	"memo" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_bills_schedules" (
	"id" varchar PRIMARY KEY NOT NULL,
	"vendor_id" varchar NOT NULL,
	"bill_id" varchar NOT NULL,
	"recurrency_period" "recurrency_period" NOT NULL,
	"recurrency_end_date" date,
	"next_bill_date" date,
	"last_generated_date" date
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"address" varchar,
	"tax_pin" varchar,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_tax_pin_unique" UNIQUE("tax_pin")
);
--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_expense_account_id_ledger_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment_lines" ADD CONSTRAINT "bill_payment_lines_bill_payment_id_bill_payments_id_fk" FOREIGN KEY ("bill_payment_id") REFERENCES "public"."bill_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment_lines" ADD CONSTRAINT "bill_payment_lines_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment_lines" ADD CONSTRAINT "bill_payment_lines_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bills_schedules" ADD CONSTRAINT "recurring_bills_schedules_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bills_schedules" ADD CONSTRAINT "recurring_bills_schedules_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bill_items_bill_id" ON "bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "idx_bill_payment_lines_bill_payment_id" ON "bill_payment_lines" USING btree ("bill_payment_id");--> statement-breakpoint
CREATE INDEX "idx_bill_payment_lines_vendor_id" ON "bill_payment_lines" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_bill_payment_lines_bill_id" ON "bill_payment_lines" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "idx_bill_payments_payment_no" ON "bill_payments" USING btree ("payment_no");--> statement-breakpoint
CREATE INDEX "idx_bill_payments_payment_date" ON "bill_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_bill_payments_reference" ON "bill_payments" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_bills_vendor_id" ON "bills" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_bills_invoice_no" ON "bills" USING btree ("invoice_no");--> statement-breakpoint
CREATE INDEX "idx_bills_invoice_date" ON "bills" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "idx_bills_due_date" ON "bills" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_bills_status" ON "bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vendors_name" ON "vendors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_vendors_tax_pin" ON "vendors" USING btree ("tax_pin");--> statement-breakpoint
CREATE INDEX "idx_vendors_email" ON "vendors" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_vendors_phone" ON "vendors" USING btree ("phone");