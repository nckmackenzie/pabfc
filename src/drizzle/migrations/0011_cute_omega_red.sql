ALTER TABLE "users" ADD COLUMN "member_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_unique" UNIQUE("member_id");