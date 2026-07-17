CREATE TABLE "addon_invoice_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"addon_invoice_id" varchar NOT NULL,
	"addon_id" varchar,
	"addon_name" varchar(255) NOT NULL,
	"unit_amount" numeric(10, 2) NOT NULL,
	"per_member" boolean NOT NULL,
	"revenue_account_id" integer NOT NULL,
	"number_of_periods" integer NOT NULL,
	"number_of_members" integer DEFAULT 1 NOT NULL,
	"line_subtotal" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon_invoices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"invoice_no" varchar(50) NOT NULL,
	"member_id" varchar NOT NULL,
	"payment_id" varchar,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"number_of_periods" integer DEFAULT 1 NOT NULL,
	"number_of_members" integer DEFAULT 1 NOT NULL,
	"subtotal_amount" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"vat_type" "vat_type" DEFAULT 'none' NOT NULL,
	"status" "payment_status" DEFAULT 'completed' NOT NULL,
	"method" "payment_method" NOT NULL,
	"channel" "payment_channel" NOT NULL,
	"reference" varchar(50),
	"notes" text,
	"created_by_user_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addon_invoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "addons" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"amount" numeric(10, 2) NOT NULL,
	"per_member" boolean DEFAULT false NOT NULL,
	"revenue_account_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_system_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "addon_invoice_lines" ADD CONSTRAINT "addon_invoice_lines_addon_invoice_id_addon_invoices_id_fk" FOREIGN KEY ("addon_invoice_id") REFERENCES "public"."addon_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_invoice_lines" ADD CONSTRAINT "addon_invoice_lines_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_invoice_lines" ADD CONSTRAINT "addon_invoice_lines_revenue_account_id_ledger_accounts_id_fk" FOREIGN KEY ("revenue_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_invoices" ADD CONSTRAINT "addon_invoices_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_invoices" ADD CONSTRAINT "addon_invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_revenue_account_id_ledger_accounts_id_fk" FOREIGN KEY ("revenue_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;