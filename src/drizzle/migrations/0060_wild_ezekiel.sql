CREATE TYPE "public"."employment_status" AS ENUM('active', 'on_leave', 'terminated', 'resigned');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'temporary');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"manager_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar PRIMARY KEY NOT NULL,
	"employee_no" varchar(20) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"gender" "gender" NOT NULL,
	"national_id" varchar(20),
	"date_of_birth" date,
	"kra_pin" varchar(20),
	"nssf_no" varchar(30),
	"shif_no" varchar(30),
	"helb_ref" varchar(30),
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"emergency_contact" varchar(20),
	"next_of_kin" varchar(20),
	"job_title" varchar(150),
	"department_id" integer,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"status" "employment_status" DEFAULT 'active' NOT NULL,
	"hire_date" date,
	"termination_date" date,
	"bank_name" varchar(100),
	"bank_account_no" varchar(30),
	"bank_branch" varchar(100),
	"is_resident" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_no_unique" UNIQUE("employee_no"),
	CONSTRAINT "employees_national_id_unique" UNIQUE("national_id"),
	CONSTRAINT "employees_kra_pin_unique" UNIQUE("kra_pin"),
	CONSTRAINT "employees_nssf_no_unique" UNIQUE("nssf_no"),
	CONSTRAINT "employees_shif_no_unique" UNIQUE("shif_no"),
	CONSTRAINT "employees_helb_ref_unique" UNIQUE("helb_ref"),
	CONSTRAINT "employees_phone_unique" UNIQUE("phone"),
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employees_email" ON "employees" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_employees_phone" ON "employees" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_first_name_last_name" ON "employees" USING btree ("first_name","last_name");