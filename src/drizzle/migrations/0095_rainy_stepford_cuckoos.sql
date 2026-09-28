CREATE TYPE "public"."complimentary_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'complimentary';--> statement-breakpoint
CREATE TABLE "complimentary_membership_requests" (
	"id" varchar PRIMARY KEY NOT NULL,
	"member_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"start_date" date NOT NULL,
	"number_of_periods" integer DEFAULT 1 NOT NULL,
	"reason" text NOT NULL,
	"status" "complimentary_request_status" DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" varchar NOT NULL,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"resulting_payment_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "complimentary_membership_requests" ADD CONSTRAINT "complimentary_membership_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complimentary_membership_requests" ADD CONSTRAINT "complimentary_membership_requests_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complimentary_membership_requests" ADD CONSTRAINT "complimentary_membership_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complimentary_membership_requests" ADD CONSTRAINT "complimentary_membership_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complimentary_membership_requests" ADD CONSTRAINT "complimentary_membership_requests_resulting_payment_id_payments_id_fk" FOREIGN KEY ("resulting_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_complimentary_requests_status" ON "complimentary_membership_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_complimentary_requests_member_id" ON "complimentary_membership_requests" USING btree ("member_id");