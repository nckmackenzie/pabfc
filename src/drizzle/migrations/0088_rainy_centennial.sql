ALTER TABLE "membership_plans" ADD COLUMN "late_upgrade_grace_days" integer;--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD COLUMN "is_late_upgrade" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD COLUMN "days_after_expiry" integer;--> statement-breakpoint
ALTER TABLE "membership_upgrades" ADD COLUMN "late_upgrade_reason" text;