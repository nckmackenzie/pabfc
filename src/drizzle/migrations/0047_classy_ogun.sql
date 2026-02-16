ALTER TABLE "bill_payment_lines" DROP CONSTRAINT "bill_payment_lines_bill_payment_id_bill_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "bill_payment_lines" ADD CONSTRAINT "bill_payment_lines_bill_payment_id_bill_payments_id_fk" FOREIGN KEY ("bill_payment_id") REFERENCES "public"."bill_payments"("id") ON DELETE cascade ON UPDATE no action;