CREATE TYPE "public"."pay_frequency" AS ENUM('monthly', 'bi_weekly', 'weekly');--> statement-breakpoint
CREATE TABLE "salary_structures" (
	"id" varchar PRIMARY KEY NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"pay_frequency" "pay_frequency" DEFAULT 'monthly' NOT NULL,
	"basic_salary" numeric(14, 2) NOT NULL,
	"house_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"transport_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"commuter_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"meal_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"airtime_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_allowances" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_allowances_description" varchar(255),
	"pension_employee_contribution" numeric(14, 2) DEFAULT '0' NOT NULL,
	"pension_employer_contribution" numeric(14, 2) DEFAULT '0' NOT NULL,
	"pension_fund_name" varchar(100),
	"mortgage_interest_monthly" numeric(14, 2) DEFAULT '0' NOT NULL,
	"post_retirement_medical_monthly" numeric(14, 2) DEFAULT '0' NOT NULL,
	"insurance_premiums_monthly" numeric(14, 2) DEFAULT '0' NOT NULL,
	"has_helb_loan" boolean DEFAULT false NOT NULL,
	"helb_monthly_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
	"normal_hours_per_day" numeric(4, 2) DEFAULT '8' NOT NULL,
	"normal_days_per_week" numeric(4, 2) DEFAULT '5' NOT NULL,
	"overtime_hourly_rate_divisor" integer DEFAULT 225 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salary_structures_effective_to_after_from" CHECK ("salary_structures"."effective_to" is null or "salary_structures"."effective_to" > "salary_structures"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_salary_structures_employee" ON "salary_structures" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_salary_structures_employee_effective_from" ON "salary_structures" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE INDEX "idx_salary_structures_employee_effective_to" ON "salary_structures" USING btree ("employee_id","effective_to");--> statement-breakpoint
CREATE INDEX "idx_salary_structures_employee_active" ON "salary_structures" USING btree ("employee_id","is_active");