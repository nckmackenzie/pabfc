CREATE TABLE "password_reset_attempts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" text,
	"identifier_hash" text NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"matched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_attempts" ADD CONSTRAINT "password_reset_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_reset_attempts_user_id_idx" ON "password_reset_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_attempts_identifier_hash_idx" ON "password_reset_attempts" USING btree ("identifier_hash");--> statement-breakpoint
CREATE INDEX "password_reset_attempts_ip_address_idx" ON "password_reset_attempts" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "password_reset_attempts_created_at_idx" ON "password_reset_attempts" USING btree ("created_at");