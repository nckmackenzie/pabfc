ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "users_name_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_contact_idx" ON "users" USING btree ("contact");