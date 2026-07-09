CREATE TABLE "payment_members" (
	"id" varchar PRIMARY KEY NOT NULL,
	"payment_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_plans" ADD COLUMN "member_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_members" ADD CONSTRAINT "payment_members_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_members" ADD CONSTRAINT "payment_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_members_payment_member" ON "payment_members" USING btree ("payment_id","member_id");--> statement-breakpoint
CREATE INDEX "idx_payment_members_member_id" ON "payment_members" USING btree ("member_id");