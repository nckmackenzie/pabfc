import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import type { SalaryHistoryListItem } from "@/features/payroll/services/salary-structures.api";
import { currencyFormatter } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const statusVariant = {
	active: "success",
	superseded: "secondary",
	future: "warning",
} as const;

export function SalaryStructureEmployeeHistory({
	employee,
	history,
}: {
	employee: {
		id: string;
		employeeNo: string;
		fullName: string;
		status: string;
		jobTitle: string | null;
	};
	history: Array<SalaryHistoryListItem>;
}) {
	if (!history.length) {
		return (
			<EmptyState
				title="No Salary Structures"
				description="This employee does not have any salary structures yet."
				path="/app/payroll/salary-structures/new"
				buttonName="Create Salary Structure"
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
						<Link to="/app/payroll/salary-structures/new" search={{ employeeId: employee.id }}>
							Add Structure
						</Link>
					</Button>
				</div>
			</div>

			<div className="space-y-4">
				{history.map((item) => (
					<div key={item.id} className="rounded-md border bg-card p-5 space-y-4">
						<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h2 className="text-lg font-semibold">{currencyFormatter(item.grossPay)}</h2>
									<Badge variant={statusVariant[item.status]}>{toTitleCase(item.status)}</Badge>
								</div>
								<p className="text-sm text-muted-foreground">
									{item.effectiveFrom} to {item.effectiveTo ?? "Current"}
								</p>
								<p className="text-sm text-muted-foreground">
									Pay frequency: {toTitleCase(item.payFrequency.replace("_", " "))}
								</p>
							</div>
							<Link
								to="/app/payroll/salary-structures/structure/$structureId"
								params={{ structureId: String(item.id) }}
								className="text-sm font-medium text-primary underline-offset-4 hover:underline"
							>
								View full breakdown
							</Link>
						</div>
						{item.notes ? <p className="text-sm text-muted-foreground">{item.notes}</p> : null}
					</div>
				))}
			</div>
		</div>
	);
}
