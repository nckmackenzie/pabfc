ALTER TABLE "mpesa_stk_requests" ALTER COLUMN "invoice_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "mpesa_stk_requests" ALTER COLUMN "payment_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "payment_applications" ALTER COLUMN "payment_id" SET DATA TYPE varchar;