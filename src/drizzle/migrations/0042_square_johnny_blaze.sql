ALTER TABLE "bill_payment_lines" DROP CONSTRAINT "bill_payment_lines_vendor_id_vendors_id_fk";
--> statement-breakpoint
DROP INDEX "idx_bill_payment_lines_vendor_id";--> statement-breakpoint
ALTER TABLE "bill_payments" ADD COLUMN "vendor_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment_lines" DROP COLUMN "vendor_id";