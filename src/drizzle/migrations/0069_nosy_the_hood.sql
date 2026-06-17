CREATE TYPE "public"."statutory_rate_category" AS ENUM('paye_band', 'nssf_tier_1_upper_limit', 'nssf_tier_2_upper_limit', 'nssf_contribution_rate', 'nssf_max_employee', 'nssf_max_employer', 'shif', 'ahl_employee_rate', 'ahl_employer_rate', 'nita', 'personal_relief', 'insurance_relief', 'pension_cap', 'mortgage_cap', 'post_retirement_medical_cap', 'non_cash_benefit_exempt', 'meal_allowance_exempt');--> statement-breakpoint
CREATE TABLE "statutory_rates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"category" "statutory_rate_category" NOT NULL,
	"label" varchar(100) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"lower_bound" numeric(14, 2),
	"upper_bound" numeric(14, 2),
	"rate" numeric(10, 6),
	"fixed_amount" numeric(14, 2),
	"notes" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statutory_rates_effective_to_after_from" CHECK ("statutory_rates"."effective_to" is null or "statutory_rates"."effective_to" >= "statutory_rates"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "statutory_rates" ADD CONSTRAINT "statutory_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_statutory_rates_category_effective_from" ON "statutory_rates" USING btree ("category","effective_from");--> statement-breakpoint
CREATE INDEX "idx_statutory_rates_category_effective_to" ON "statutory_rates" USING btree ("category","effective_to");--> statement-breakpoint
CREATE INDEX "idx_statutory_rates_effective_from" ON "statutory_rates" USING btree ("effective_from");