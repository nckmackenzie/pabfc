CREATE TYPE "public"."sms_recipient_type" AS ENUM('members', 'enquiries');--> statement-breakpoint
ALTER TYPE "public"."sms_filter_criteria" ADD VALUE 'specific enquiries';--> statement-breakpoint
ALTER TYPE "public"."sms_filter_criteria" ADD VALUE 'filtered enquiries';--> statement-breakpoint
ALTER TABLE "sms_broadcasts" ADD COLUMN "recipient_type" "sms_recipient_type" DEFAULT 'members' NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_broadcasts" ADD COLUMN "recipient_filter" jsonb;