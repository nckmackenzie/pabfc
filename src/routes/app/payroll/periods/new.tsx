import { PayrollPeriodForm } from "@/features/payroll/components/payroll-period/payroll-period-form";
import { seo } from "@/lib/helpers";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/payroll/periods/new")({
	component: PayrollPeriodForm,
	head: () => ({ meta: seo({ title: "Add Payroll Period" }) }),
	staticData: {
		breadcrumb: "Add Payroll Period",
	},
});
