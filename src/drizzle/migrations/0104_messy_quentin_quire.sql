CREATE TYPE "public"."enquiry_lost_reason" AS ENUM('price', 'location', 'schedule', 'joined_other_gym', 'no_response', 'not_interested', 'other');--> statement-breakpoint
CREATE TYPE "public"."enquiry_source" AS ENUM('walk_in', 'phone_call', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'google', 'website', 'referral', 'flyer_signage', 'other');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'contacted', 'registered', 'converted', 'lost');--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"phone" varchar(13) NOT NULL,
	"email" varchar(255),
	"source" "enquiry_source" NOT NULL,
	"source_notes" varchar(255),
	"interested_plan_id" varchar,
	"notes" text,
	"status" "enquiry_status" DEFAULT 'new' NOT NULL,
	"lost_reason" "enquiry_lost_reason",
	"lost_reason_notes" varchar(255),
	"follow_up_date" date,
	"assigned_employee_id" varchar,
	"sms_consent" boolean DEFAULT false NOT NULL,
	"sms_consent_at" timestamp with time zone,
	"converted_member_id" varchar,
	"registered_at" timestamp with time zone,
	"converted_payment_id" varchar,
	"converted_at" timestamp with time zone,
	"created_by_user_id" varchar,
	"updated_by_user_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_interested_plan_id_membership_plans_id_fk" FOREIGN KEY ("interested_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_employee_id_employees_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_converted_member_id_members_id_fk" FOREIGN KEY ("converted_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_converted_payment_id_payments_id_fk" FOREIGN KEY ("converted_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_enquiries_status" ON "enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_enquiries_follow_up_date" ON "enquiries" USING btree ("follow_up_date");--> statement-breakpoint
CREATE INDEX "idx_enquiries_created_at" ON "enquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_enquiries_assigned_employee_id" ON "enquiries" USING btree ("assigned_employee_id");--> statement-breakpoint
CREATE INDEX "idx_enquiries_converted_member_id" ON "enquiries" USING btree ("converted_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enquiries_open_phone" ON "enquiries" USING btree ("phone") WHERE "enquiries"."status" IN ('new', 'contacted') AND "enquiries"."deleted_at" IS NULL;