ALTER TABLE "membership_plans" ADD COLUMN "price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_plans" ADD COLUMN "valid_from" date NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_plans" ADD COLUMN "valid_to" date NOT NULL;