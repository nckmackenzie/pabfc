CREATE TYPE "public"."sms_broadcast_status" AS ENUM('draft', 'sent');--> statement-breakpoint
CREATE TYPE "public"."sms_filter_criteria" AS ENUM('by status', 'by plan');--> statement-breakpoint
CREATE TABLE "sms_broadcasts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"filter_criteria" "sms_filter_criteria" NOT NULL,
	"criteria" varchar(255) NOT NULL,
	"sms_template_id" varchar,
	"message" text NOT NULL,
	"receipients" text[] NOT NULL,
	"sms_broadcast_status" "sms_broadcast_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_broadcasts" ADD CONSTRAINT "sms_broadcasts_sms_template_id_sms_templates_id_fk" FOREIGN KEY ("sms_template_id") REFERENCES "public"."sms_templates"("id") ON DELETE set null ON UPDATE no action;