CREATE TABLE "membership_session_usage" (
	"id" varchar PRIMARY KEY NOT NULL,
	"membership_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"usage_date" date NOT NULL,
	"source" varchar(20) NOT NULL,
	"attendance_log_id" bigint,
	"reason" text,
	"created_by_user_id" varchar,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" varchar,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_memberships" ADD COLUMN "sessions_total" integer;--> statement-breakpoint
ALTER TABLE "member_memberships" ADD COLUMN "original_end_date" date;--> statement-breakpoint
ALTER TABLE "membership_session_usage" ADD CONSTRAINT "membership_session_usage_membership_id_member_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."member_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_session_usage" ADD CONSTRAINT "membership_session_usage_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_session_usage" ADD CONSTRAINT "membership_session_usage_attendance_log_id_attendance_logs_id_fk" FOREIGN KEY ("attendance_log_id") REFERENCES "public"."attendance_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_session_usage" ADD CONSTRAINT "membership_session_usage_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_session_usage" ADD CONSTRAINT "membership_session_usage_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_membership_session_usage_membership_date" ON "membership_session_usage" USING btree ("membership_id","usage_date");--> statement-breakpoint
CREATE INDEX "idx_membership_session_usage_member_date" ON "membership_session_usage" USING btree ("member_id","usage_date");