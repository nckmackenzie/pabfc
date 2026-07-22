CREATE TABLE "membership_upgrades" (
	"id" varchar PRIMARY KEY NOT NULL,
	"original_payment_id" varchar NOT NULL,
	"upgrade_payment_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"original_plan_id" varchar NOT NULL,
	"new_plan_id" varchar NOT NULL,
	"original_end_date" date,
	"new_end_date" date,
	"top_up_amount" numeric(18, 2) NOT NULL,
	"upgrade_date" date NOT NULL,
	"notes" text,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD CONSTRAINT "membership_upgrades_original_payment_id_payments_id_fk" FOREIGN KEY ("original_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD CONSTRAINT "membership_upgrades_upgrade_payment_id_payments_id_fk" FOREIGN KEY ("upgrade_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD CONSTRAINT "membership_upgrades_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD CONSTRAINT "membership_upgrades_original_plan_id_membership_plans_id_fk" FOREIGN KEY ("original_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD CONSTRAINT "membership_upgrades_new_plan_id_membership_plans_id_fk" FOREIGN KEY ("new_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD CONSTRAINT "membership_upgrades_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_membership_upgrades_original_payment_id" ON "membership_upgrades" USING btree ("original_payment_id");--> statement-breakpoint
CREATE INDEX "idx_membership_upgrades_upgrade_payment_id" ON "membership_upgrades" USING btree ("upgrade_payment_id");