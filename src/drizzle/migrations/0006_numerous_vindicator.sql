CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'unspecified', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive', 'frozen', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'inactive', 'frozen', 'terminated', 'expired', 'pending', 'cancelled', 'suspended', '');--> statement-breakpoint
CREATE TABLE "member_memberships" (
	"id" varchar PRIMARY KEY NOT NULL,
	"member_id" varchar NOT NULL,
	"membership_plan_id" varchar NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"freeze_start_date" date,
	"freeze_end_date" date,
	"freeze_reason" varchar(255),
	"terminated_at" date,
	"terminated_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" varchar PRIMARY KEY NOT NULL,
	"member_no" integer DEFAULT 0 NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"date_of_birth" date,
	"gender" "gender" DEFAULT 'unspecified' NOT NULL,
	"email" varchar,
	"contact" varchar(15),
	"id_type" varchar(20),
	"id_number" varchar(20),
	"member_status" "member_status" DEFAULT 'active' NOT NULL,
	"address" varchar(255),
	"city" varchar(100),
	"state" varchar(100),
	"zip_code" varchar(20),
	"country" varchar(100),
	"emergency_contact_name" varchar(100),
	"emergency_contact_no" varchar(15),
	"emergency_contact_relationship" varchar(100),
	"device_id" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_member_no_unique" UNIQUE("member_no"),
	CONSTRAINT "members_email_unique" UNIQUE("email"),
	CONSTRAINT "members_contact_unique" UNIQUE("contact"),
	CONSTRAINT "members_id_number_unique" UNIQUE("id_number"),
	CONSTRAINT "members_emergency_contact_no_unique" UNIQUE("emergency_contact_no")
);
--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"duration" integer NOT NULL,
	"is_session_based" boolean DEFAULT false NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_memberships" ADD CONSTRAINT "member_memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_memberships" ADD CONSTRAINT "member_memberships_membership_plan_id_membership_plans_id_fk" FOREIGN KEY ("membership_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_member_membership_member_id" ON "member_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_membership_membership_plan_id" ON "member_memberships" USING btree ("membership_plan_id");--> statement-breakpoint
CREATE INDEX "idx_member_first_name" ON "members" USING btree ("first_name");--> statement-breakpoint
CREATE INDEX "idx_member_last_name" ON "members" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "idx_member_status" ON "members" USING btree ("member_status");--> statement-breakpoint
CREATE INDEX "idx_membership_plan_name" ON "membership_plans" USING btree ("name");