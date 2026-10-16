ALTER TABLE "membership_plans" ADD COLUMN "is_guest_pass" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "sponsor_member_id" varchar;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sponsor_member_id_members_id_fk" FOREIGN KEY ("sponsor_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payments_sponsor_member_id" ON "payments" USING btree ("sponsor_member_id");