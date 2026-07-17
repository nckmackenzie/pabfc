CREATE TABLE "financial_years" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"closed_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "financial_years_name_idx" ON "financial_years" USING btree ("name");
--> statement-breakpoint
CREATE INDEX "financial_years_start_date_idx" ON "financial_years" USING btree ("start_date");
