CREATE TYPE "public"."leave_applicable_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('annual', 'sick', 'maternity', 'paternity', 'pre_adoptive', 'compassionate', 'study', 'unpaid');--> statement-breakpoint
CREATE TABLE "employee_leave_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"leave_year" integer NOT NULL,
	"entitled_days" numeric(6, 2) DEFAULT '0' NOT NULL,
	"carried_forward_days" numeric(6, 2) DEFAULT '0' NOT NULL,
	"adjustment_days" numeric(6, 2) DEFAULT '0' NOT NULL,
	"taken_days" numeric(6, 2) DEFAULT '0' NOT NULL,
	"carry_forward_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_balance_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"leave_year" integer NOT NULL,
	"adjustment_days" numeric(6, 2) NOT NULL,
	"reason" text NOT NULL,
	"performed_by" varchar(255),
	"applied_to_balance_adjustment_total" boolean DEFAULT true NOT NULL,
	"warning" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"annual_days_entitled" numeric(6, 2) NOT NULL,
	"accrual_rate_per_month" numeric(6, 4),
	"is_paid" boolean DEFAULT true NOT NULL,
	"full_pay_days" numeric(6, 2) DEFAULT '0' NOT NULL,
	"half_pay_days" numeric(6, 2) DEFAULT '0' NOT NULL,
	"carry_forward_allowed" boolean DEFAULT false NOT NULL,
	"carry_forward_cap_days" numeric(6, 2),
	"carry_forward_expiry_months" integer,
	"min_service_months_required" integer DEFAULT 0 NOT NULL,
	"requires_medical_cert" boolean DEFAULT false NOT NULL,
	"applicable_gender" "leave_applicable_gender",
	"is_one_off_entitlement" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_entitlements_leave_type_unique" UNIQUE("leave_type")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" varchar PRIMARY KEY NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"leave_year" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"working_days_requested" numeric(6, 2) NOT NULL,
	"reason" text,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"requested_by" varchar(255),
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"cancelled_by" varchar(255),
	"cancelled_at" timestamp with time zone,
	"medical_cert_path" varchar(500),
	"medical_certificate_required" boolean DEFAULT false NOT NULL,
	"affects_payroll" boolean DEFAULT false NOT NULL,
	"payroll_impact_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"holiday_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_holidays_holiday_date_unique" UNIQUE("holiday_date")
);
--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employee_leave_balance_employee_type_year" ON "employee_leave_balances" USING btree ("employee_id","leave_type","leave_year");--> statement-breakpoint
CREATE INDEX "idx_employee_leave_balances_employee" ON "employee_leave_balances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_leave_balances_year" ON "employee_leave_balances" USING btree ("leave_year");--> statement-breakpoint
CREATE INDEX "idx_leave_balance_adjustments_employee" ON "leave_balance_adjustments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_leave_balance_adjustments_year" ON "leave_balance_adjustments" USING btree ("leave_year");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_employee" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_status" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_year" ON "leave_requests" USING btree ("leave_year");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_dates" ON "leave_requests" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_public_holidays_date" ON "public_holidays" USING btree ("holiday_date");