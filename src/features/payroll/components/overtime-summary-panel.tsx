import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { formatPayrollPeriod } from "@/features/payroll/lib/overtime-options";
import type { OvertimeSummaryView } from "@/features/payroll/services/overtime.api";
import { currencyFormatter } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const statusVariant = {
	draft: "warning",
	approved: "success",
	paid: "secondary",
} as const;

export function OvertimeSummaryPanel({
	employee,
	summary,
}: {
	employee: {
		id: string;
		employeeNo: string;
		fullName: string;
		status: string;
		jobTitle: string | null;
	};
	summary: OvertimeSummaryView;
}) {
	if (!summary.records.length) {
		return (
			<EmptyState
				title="No Overtime Records"
				description="No overtime records were found for this employee in the selected range."
				path="/app/payroll/overtime/new"
				buttonName="Create Overtime Record"
			/>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 rounded-md border bg-card p-6 md:flex-row md:items-start md:justify-between">
				<div className="space-y-1">
					<p className="text-sm text-muted-foreground">Employee</p>
					<h1 className="text-2xl font-semibold">{toTitleCase(employee.fullName)}</h1>
					<p className="text-sm text-muted-foreground">
						{`E${employee.employeeNo}`}
						{employee.jobTitle ? ` • ${employee.jobTitle}` : ""}
					</p>
				</div>
				<div className="flex gap-2">
					<Badge variant="outline">{toTitleCase(employee.status.replace("_", " "))}</Badge>
					<Button asChild size="lg">
						<Link to="/app/payroll/overtime/new" search={{ employeeId: employee.id }}>
							Add Overtime
						</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-4">
				<div className="rounded-md border bg-card p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">Weekday Hours</p>
					<p className="mt-2 text-lg font-semibold">
						{summary.totals.weekdayOvertimeHours.toFixed(2)}
					</p>
				</div>
				<div className="rounded-md border bg-card p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">Weekend Hours</p>
					<p className="mt-2 text-lg font-semibold">
						{summary.totals.weekendOvertimeHours.toFixed(2)}
					</p>
				</div>
				<div className="rounded-md border bg-card p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">Holiday Hours</p>
					<p className="mt-2 text-lg font-semibold">
						{summary.totals.publicHolidayOvertimeHours.toFixed(2)}
					</p>
				</div>
				<div className="rounded-md border bg-card p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">Total Pay</p>
					<p className="mt-2 text-lg font-semibold">
						{currencyFormatter(summary.totals.totalOvertimePay)}
					</p>
				</div>
			</div>

			<div className="space-y-4">
				{summary.records.map((record) => (
					<div key={record.id} className="rounded-md border bg-card p-5 space-y-4">
						<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h2 className="text-lg font-semibold">
										{formatPayrollPeriod(record.periodMonth, record.periodYear)}
									</h2>
									<Badge variant={statusVariant[record.status]}>
										{toTitleCase(record.status)}
									</Badge>
								</div>
								<p className="text-sm text-muted-foreground">
									Total Hours:{" "}
									{(
										record.weekdayOvertimeHours +
										record.weekendOvertimeHours +
										record.publicHolidayOvertimeHours
									).toFixed(2)}
								</p>
								<p className="text-sm text-muted-foreground">
									Total Pay: {currencyFormatter(record.totalOvertimePay)}
								</p>
							</div>
							<Link
								to="/app/payroll/overtime/$recordId"
								params={{ recordId: record.id }}
								className="text-sm font-medium text-primary underline-offset-4 hover:underline"
							>
								View record
							</Link>
						</div>
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-md border bg-muted/30 p-3 text-sm">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Weekday Hours
								</p>
								<p className="mt-1 font-medium">{record.weekdayOvertimeHours.toFixed(2)}</p>
							</div>
							<div className="rounded-md border bg-muted/30 p-3 text-sm">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Weekend Hours
								</p>
								<p className="mt-1 font-medium">{record.weekendOvertimeHours.toFixed(2)}</p>
							</div>
							<div className="rounded-md border bg-muted/30 p-3 text-sm">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Public Holiday Hours
								</p>
								<p className="mt-1 font-medium">
									{record.publicHolidayOvertimeHours.toFixed(2)}
								</p>
							</div>
						</div>
						{record.notes ? <p className="text-sm text-muted-foreground">{record.notes}</p> : null}
					</div>
				))}
			</div>
		</div>
	);
}
