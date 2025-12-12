CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'partially_paid', 'paid', 'cancelled', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."mpesa_stk_status" AS ENUM('pending', 'success', 'failed', 'timeout', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_channel" AS ENUM('portal', 'staff', 'auto_renewal');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('mpesa_stk', 'mpesa_manual', 'cash', 'card', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TABLE "customer_invoice_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"description" text NOT NULL,
	"plan_id" varchar,
	"membership_id" varchar,
	"quantity" numeric(18, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"line_subtotal" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 2) NOT NULL,
	"revenue_account_id" integer NOT NULL,
	"tax_account_id" integer
);
--> statement-breakpoint
CREATE TABLE "customer_invoices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"invoice_no" varchar(50) NOT NULL,
	"member_id" varchar NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "invoice_status" DEFAULT 'open' NOT NULL,
	"currency" varchar(10) DEFAULT 'KES' NOT NULL,
	"subtotal_amount" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"balance_amount" numeric(18, 2) NOT NULL,
	"source" varchar(50),
	"source_id" varchar,
	"channel" "payment_channel",
	"created_by_user_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_invoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "mpesa_stk_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" varchar NOT NULL,
	"invoice_id" integer NOT NULL,
	"payment_id" integer,
	"phone_number" varchar(20) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" "mpesa_stk_status" DEFAULT 'pending' NOT NULL,
	"merchant_request_id" varchar(100),
	"checkout_request_id" varchar(100),
	"raw_request" jsonb,
	"raw_response" jsonb,
	"callback_payload" jsonb,
	"error_code" varchar(50),
	"error_message" varchar(255),
	"initiated_channel" "payment_channel" NOT NULL,
	"initiated_by_user_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"callback_received_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"invoice_id" varchar NOT NULL,
	"amount_applied" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY NOT NULL,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" varchar NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'KES' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"method" "payment_method" NOT NULL,
	"channel" "payment_channel" NOT NULL,
	"reference" varchar(50),
	"external_reference" varchar(100),
	"created_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_membership_id_member_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."member_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_revenue_account_id_ledger_accounts_id_fk" FOREIGN KEY ("revenue_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_tax_account_id_ledger_accounts_id_fk" FOREIGN KEY ("tax_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_stk_requests" ADD CONSTRAINT "mpesa_stk_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_stk_requests" ADD CONSTRAINT "mpesa_stk_requests_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_stk_requests" ADD CONSTRAINT "mpesa_stk_requests_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;