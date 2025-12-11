ALTER TABLE "payments" ADD COLUMN "payment_no" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_no_unique" UNIQUE("payment_no");