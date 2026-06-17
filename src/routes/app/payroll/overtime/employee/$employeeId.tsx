import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BackLink } from "@/components/ui/links";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { OvertimeSummaryPanel } from "@/features/payroll/components/overtime-summary-panel";
import { PAYROLL_MONTH_OPTIONS, getPayrollYearOptions } from "@/features/payroll/lib/overtime-options";
import { overtimeQueries, salaryStructureQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useFilters } from "@/hooks/use-filters";

const today = new Date();
const yearOptions = getPayrollYearOptions({
	startYear: 2020,
	endYear: today.getUTCFullYear(),
});

const overtimeSummarySearchSchema = z.object({
	fromMonth: z.coerce.number().int().min(1).max(12).catch(1),
	fromYear: z.coerce.number().int().min(2000).max(2100).catch(today.getUTCFullYear()),
	toMonth: z.coerce.number().int().min(1).max(12).catch(today.getUTCMonth() + 1),
	toYear: z.coerce.number().int().min(2000).max(2100).catch(today.getUTCFullYear()),
});

export const Route = createFileRoute("/app/payroll/overtime/employee/$employeeId")({
	component: RouteComponent,
	validateSearch: overtimeSummarySearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("overtime-records:view");
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, params, deps: search }) => {
		await Promise.all([
			queryClient.ensureQueryData(
				salaryStructureQueries.employeeSummary({ employeeId: params.employeeId })
			),
			queryClient.ensureQueryData(
				overtimeQueries.summary({
					employeeId: params.employeeId,
					...search,
				})
			),
		]);
	},
	head: () => ({ meta: seo({ title: "Employee Overtime History" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Employee Overtime History"
			pageDescription="Loading overtime history..."
		/>
	),
	staticData: {
		breadcrumb: "Employee Overtime History",
	},
});

function RouteComponent() {
	const params = Route.useParams();
	const { filters, setFilters } = useFilters(
		Route.id,
	);
	const employeeQuery = useSuspenseQuery(
		salaryStructureQueries.employeeSummary({ employeeId: params.employeeId })
	);
	const summaryQuery = useSuspenseQuery(
		overtimeQueries.summary({
			employeeId: params.employeeId,
			fromMonth: filters.fromMonth,
			fromYear: filters.fromYear,
			toMonth: filters.toMonth,
			toYear: filters.toYear,
		})
	);

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/overtime">Back to Overtime Records</BackLink>
			<div className="grid gap-3 md:grid-cols-4">
				<Select
					value={String(filters.fromMonth)}
					onValueChange={(value) => setFilters({ fromMonth: Number(value) })}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="From month" />
					</SelectTrigger>
					<SelectContent>
						{PAYROLL_MONTH_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={String(option.value)}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={String(filters.fromYear)}
					onValueChange={(value) => setFilters({ fromYear: Number(value) })}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="From year" />
					</SelectTrigger>
					<SelectContent>
						{yearOptions.map((option) => (
							<SelectItem key={option.value} value={String(option.value)}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={String(filters.toMonth)}
					onValueChange={(value) => setFilters({ toMonth: Number(value) })}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="To month" />
					</SelectTrigger>
					<SelectContent>
						{PAYROLL_MONTH_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={String(option.value)}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={String(filters.toYear)}
					onValueChange={(value) => setFilters({ toYear: Number(value) })}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="To year" />
					</SelectTrigger>
					<SelectContent>
						{yearOptions.map((option) => (
							<SelectItem key={option.value} value={String(option.value)}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<OvertimeSummaryPanel employee={employeeQuery.data} summary={summaryQuery.data} />
		</div>
	);
}
