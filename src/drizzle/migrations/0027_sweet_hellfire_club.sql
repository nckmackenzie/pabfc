ALTER TABLE "payments" ADD COLUMN "line_total" numeric(18, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "vat_type" "vat_type" DEFAULT 'none' NOT NULL;