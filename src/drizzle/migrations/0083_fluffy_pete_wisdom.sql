ALTER TYPE "public"."payment_status" ADD VALUE 'voided';--> statement-breakpoint
ALTER TABLE "addon_invoices" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "addon_invoices" ADD COLUMN "voided_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "addon_invoices" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "voided_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "void_reason" text;