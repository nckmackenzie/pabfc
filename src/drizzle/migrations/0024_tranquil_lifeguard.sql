CREATE TYPE "public"."discount_type" AS ENUM('none', 'amount', 'percentage');--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "discount_type" "discount_type" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "discount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "discount_amount" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "total_amount" numeric(18, 2) NOT NULL;