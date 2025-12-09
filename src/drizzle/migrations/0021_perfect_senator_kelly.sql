ALTER TABLE "member_memberships" ADD COLUMN "price_charged" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "member_memberships" ADD COLUMN "invoice_id" varchar(255);--> statement-breakpoint
ALTER TABLE "member_memberships" ADD COLUMN "payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "member_memberships" ADD COLUMN "previous_membership_plan_id" varchar(255);