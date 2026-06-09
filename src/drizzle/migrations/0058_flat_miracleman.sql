CREATE TABLE "password_reset_challenges" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"identifier_hash" text NOT NULL,
	"temporary_password_hash" text NOT NULL,
	"encrypted_temporary_password" text,
	"ip_address" "inet",
	"user_agent" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_challenges" ADD CONSTRAINT "password_reset_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_reset_challenges_user_id_idx" ON "password_reset_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_challenges_identifier_hash_idx" ON "password_reset_challenges" USING btree ("identifier_hash");--> statement-breakpoint
CREATE INDEX "password_reset_challenges_ip_address_idx" ON "password_reset_challenges" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "password_reset_challenges_expires_at_idx" ON "password_reset_challenges" USING btree ("expires_at");