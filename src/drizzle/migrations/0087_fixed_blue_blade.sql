CREATE TYPE "public"."credit_note_status" AS ENUM('active', 'partially_redeemed', 'fully_redeemed', 'expired');--> statement-breakpoint
CREATE TABLE "credit_note_redemptions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"credit_note_id" varchar NOT NULL,
	"payment_id" varchar,
	"addon_invoice_id" varchar,
	"amount_applied" numeric(18, 2) NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_credit_note_redemptions_exactly_one_target" CHECK ((
				("credit_note_redemptions"."payment_id" IS NOT NULL AND "credit_note_redemptions"."addon_invoice_id" IS NULL) OR
				("credit_note_redemptions"."payment_id" IS NULL AND "credit_note_redemptions"."addon_invoice_id" IS NOT NULL)
			))
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"credit_note_no" varchar(50) NOT NULL,
	"member_id" varchar NOT NULL,
	"original_payment_id" varchar NOT NULL,
	"original_membership_id" varchar NOT NULL,
	"reason" text NOT NULL,
	"unused_days" integer NOT NULL,
	"daily_rate" numeric(18, 2) NOT NULL,
	"suggested_amount" numeric(18, 2) NOT NULL,
	"credit_subtotal" numeric(18, 2) NOT NULL,
	"credit_tax" numeric(18, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"balance_remaining" numeric(18, 2) NOT NULL,
	"status" "credit_note_status" DEFAULT 'active' NOT NULL,
	"expires_at" date NOT NULL,
	"issued_by_user_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_credit_note_no_unique" UNIQUE("credit_note_no")
);
--> statement-breakpoint
ALTER TABLE "credit_note_redemptions" ADD CONSTRAINT "credit_note_redemptions_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_redemptions" ADD CONSTRAINT "credit_note_redemptions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_redemptions" ADD CONSTRAINT "credit_note_redemptions_addon_invoice_id_addon_invoices_id_fk" FOREIGN KEY ("addon_invoice_id") REFERENCES "public"."addon_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_original_payment_id_payments_id_fk" FOREIGN KEY ("original_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_original_membership_id_member_memberships_id_fk" FOREIGN KEY ("original_membership_id") REFERENCES "public"."member_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_note_redemptions_credit_note_id_idx" ON "credit_note_redemptions" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "credit_notes_member_id_idx" ON "credit_notes" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_credit_notes_original_membership_id" ON "credit_notes" USING btree ("original_membership_id");