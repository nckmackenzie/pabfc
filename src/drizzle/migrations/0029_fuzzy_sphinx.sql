CREATE TABLE "expense_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_header_id" varchar NOT NULL,
	"file_url" varchar NOT NULL,
	"file_name" varchar,
	"file_type" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_expense_header_id_expense_headers_id_fk" FOREIGN KEY ("expense_header_id") REFERENCES "public"."expense_headers"("id") ON DELETE no action ON UPDATE no action;