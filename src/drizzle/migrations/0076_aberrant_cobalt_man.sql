DROP INDEX "idx_payroll_period_bonuses_period_employee";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payroll_period_bonuses_period_employee" ON "payroll_period_bonuses" USING btree ("payroll_period_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payroll_period_other_deductions_period_employee" ON "payroll_period_other_deductions" USING btree ("payroll_period_id","employee_id");
