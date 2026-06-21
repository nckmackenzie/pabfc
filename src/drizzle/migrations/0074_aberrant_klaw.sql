CREATE TYPE "public"."payroll_deduction_type" AS ENUM('company_loan', 'salary_advance', 'sacco', 'union_dues', 'court_order', 'insurance', 'welfare', 'helb', 'other');--> statement-breakpoint
CREATE TYPE "public"."payroll_slip_status" AS ENUM('draft', 'approved', 'cancelled');--> statement-breakpoint
CREATE TABLE "payroll_deductions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"payroll_slip_id" varchar(255) NOT NULL,
	"payroll_period_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"deduction_type" "payroll_deduction_type" NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"loan_id" varchar(255),
	"advance_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_period_bonuses" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"payroll_period_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" varchar(255) NOT NULL,
	"notes" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_period_other_deductions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"payroll_period_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"deduction_type" "payroll_deduction_type" NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_period_other_deductions_allowed_types" CHECK ("payroll_period_other_deductions"."deduction_type" not in ('company_loan', 'salary_advance', 'helb'))
);
--> statement-breakpoint
CREATE TABLE "payroll_slips" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"payroll_period_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"salary_structure_id" varchar(255) NOT NULL,
	"status" "payroll_slip_status" DEFAULT 'draft' NOT NULL,
	"is_prorated" boolean DEFAULT false NOT NULL,
	"prorated_days" integer,
	"total_working_days_in_period" integer,
	"prorated_reason" varchar(50),
	"basic_salary" numeric(14, 2) DEFAULT '0' NOT NULL,
	"house_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"transport_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"commuter_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"meal_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"airtime_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_allowances" numeric(14, 2) DEFAULT '0' NOT NULL,
	"overtime_pay" numeric(14, 2) DEFAULT '0' NOT NULL,
	"bonuses" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gross_pay" numeric(14, 2) DEFAULT '0' NOT NULL,
	"full_month_gross_pay" numeric(14, 2) DEFAULT '0' NOT NULL,
	"overtime_record_id" varchar(255),
	"weekday_overtime_hours" numeric(6, 2),
	"weekend_overtime_hours" numeric(6, 2),
	"public_holiday_overtime_hours" numeric(6, 2),
	"unpaid_leave_days" integer DEFAULT 0 NOT NULL,
	"half_pay_leave_days" integer DEFAULT 0 NOT NULL,
	"leave_deduction_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"nssf_tier_1_employee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"nssf_tier_1_employer" numeric(14, 2) DEFAULT '0' NOT NULL,
	"nssf_tier_2_employee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"nssf_tier_2_employer" numeric(14, 2) DEFAULT '0' NOT NULL,
	"nssf_employee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"nssf_employer" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shif_employee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shif_employer" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ahl_employee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ahl_employer" numeric(14, 2) DEFAULT '0' NOT NULL,
	"nita_levy" numeric(14, 2) DEFAULT '50' NOT NULL,
	"pension_allowable_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
	"mortgage_allowable_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
	"post_retirement_allowable_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
	"meal_allowance_exempt" numeric(14, 2) DEFAULT '0' NOT NULL,
	"non_cash_benefit_exempt" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_income" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gross_tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"personal_relief" numeric(14, 2) DEFAULT '0' NOT NULL,
	"insurance_relief" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_paye" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paye_band_breakdown" text,
	"pension_employee_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
	"pension_employer_contribution" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_employer_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_loan_deductions" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_advance_recoveries" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_other_deductions" numeric(14, 2) DEFAULT '0' NOT NULL,
	"helb_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_statutory_deductions" numeric(14, 2) NOT NULL,
	"total_voluntary_deductions" numeric(14, 2) NOT NULL,
	"total_deductions" numeric(14, 2) NOT NULL,
	"net_pay" numeric(14, 2) NOT NULL,
	"two_thirds_cap_applied" boolean DEFAULT false NOT NULL,
	"two_thirds_cap_amount" numeric(14, 2),
	"notes" text,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"cancelled_by" varchar(255),
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "processing_warnings" text;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "skipped_employees" text;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_slip_id_payroll_slips_id_fk" FOREIGN KEY ("payroll_slip_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_loan_id_employee_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."employee_loans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_advance_id_salary_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_bonuses" ADD CONSTRAINT "payroll_period_bonuses_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_bonuses" ADD CONSTRAINT "payroll_period_bonuses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_bonuses" ADD CONSTRAINT "payroll_period_bonuses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_other_deductions" ADD CONSTRAINT "payroll_period_other_deductions_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_other_deductions" ADD CONSTRAINT "payroll_period_other_deductions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_other_deductions" ADD CONSTRAINT "payroll_period_other_deductions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_salary_structure_id_salary_structures_id_fk" FOREIGN KEY ("salary_structure_id") REFERENCES "public"."salary_structures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_overtime_record_id_overtime_records_id_fk" FOREIGN KEY ("overtime_record_id") REFERENCES "public"."overtime_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payroll_deductions_slip" ON "payroll_deductions" USING btree ("payroll_slip_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_deductions_period_type" ON "payroll_deductions" USING btree ("payroll_period_id","deduction_type");--> statement-breakpoint
CREATE INDEX "idx_payroll_deductions_loan" ON "payroll_deductions" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_deductions_advance" ON "payroll_deductions" USING btree ("advance_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_period_bonuses_period" ON "payroll_period_bonuses" USING btree ("payroll_period_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_period_bonuses_employee" ON "payroll_period_bonuses" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_period_bonuses_period_employee" ON "payroll_period_bonuses" USING btree ("payroll_period_id","employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_period_other_deductions_period" ON "payroll_period_other_deductions" USING btree ("payroll_period_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_period_other_deductions_employee" ON "payroll_period_other_deductions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_period_other_deductions_type" ON "payroll_period_other_deductions" USING btree ("deduction_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payroll_slips_period_employee" ON "payroll_slips" USING btree ("payroll_period_id","employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_slips_period" ON "payroll_slips" USING btree ("payroll_period_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_slips_employee" ON "payroll_slips" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_slips_overtime_record" ON "payroll_slips" USING btree ("overtime_record_id");