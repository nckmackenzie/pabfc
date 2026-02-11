ALTER TABLE "bill_items" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ALTER COLUMN "quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ALTER COLUMN "unit_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "sub_total" numeric(10, 2) NOT NULL;