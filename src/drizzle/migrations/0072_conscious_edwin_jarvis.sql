ALTER TABLE "employee_loans" DROP CONSTRAINT "employee_loans_repayment_start_month_range";--> statement-breakpoint
ALTER TABLE "employee_loans" DROP CONSTRAINT "employee_loans_repayment_start_year_range";--> statement-breakpoint
ALTER TABLE "loan_repayments" DROP CONSTRAINT "loan_repayments_period_month_range";--> statement-breakpoint
ALTER TABLE "loan_repayments" DROP CONSTRAINT "loan_repayments_period_year_range";--> statement-breakpoint
ALTER TABLE "overtime_records" DROP CONSTRAINT "overtime_records_period_month_range";--> statement-breakpoint
ALTER TABLE "overtime_records" DROP CONSTRAINT "overtime_records_period_year_range";--> statement-breakpoint
ALTER TABLE "payroll_periods" DROP CONSTRAINT "payroll_periods_period_month_range";--> statement-breakpoint
ALTER TABLE "payroll_periods" DROP CONSTRAINT "payroll_periods_period_year_range";--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_repayment_start_month_range" CHECK ("employee_loans"."repayment_start_month" is null or ("employee_loans"."repayment_start_month" >= 1 and "employee_loans"."repayment_start_month" <= 12));--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_repayment_start_year_range" CHECK ("employee_loans"."repayment_start_year" is null or ("employee_loans"."repayment_start_year" >= 2000 and "employee_loans"."repayment_start_year" <= 2100));--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_period_month_range" CHECK ("loan_repayments"."period_month" >= 1 and "loan_repayments"."period_month" <= 12);--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_period_year_range" CHECK ("loan_repayments"."period_year" >= 2000 and "loan_repayments"."period_year" <= 2100);--> statement-breakpoint
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_period_month_range" CHECK ("overtime_records"."period_month" >= 1 and "overtime_records"."period_month" <= 12);--> statement-breakpoint
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_period_year_range" CHECK ("overtime_records"."period_year" >= 2000 and "overtime_records"."period_year" <= 2100);--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_period_month_range" CHECK ("payroll_periods"."period_month" >= 1 and "payroll_periods"."period_month" <= 12);--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_period_year_range" CHECK ("payroll_periods"."period_year" >= 2020 and "payroll_periods"."period_year" <= 2100);