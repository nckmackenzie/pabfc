ALTER TABLE "bill_items" ADD COLUMN "vat_type" "vat_type" DEFAULT 'exclusive' NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "vat_rate" numeric(10, 2) DEFAULT '16' NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" DROP COLUMN "vat_type";--> statement-breakpoint
ALTER TABLE "bills" DROP COLUMN "vat_rate";--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_invoice_no_unique" UNIQUE("invoice_no");