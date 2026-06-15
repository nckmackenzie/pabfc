import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { SalaryStructuresPage } from "@/features/payroll/components/salary-structures-page";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/payroll/salary-structures/")({
	component: SalaryStructuresPage,
	validateSearch: searchValidateSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("salary-structures:view");
	},
	head: () => ({ meta: seo({ title: "Salary Structures" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Salary Structures"
			pageDescription="Manage effective-dated payroll compensation records."
		/>
	),
});
