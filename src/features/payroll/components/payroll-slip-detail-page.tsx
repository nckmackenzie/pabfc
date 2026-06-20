import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BackLink } from "@/components/ui/links";
import { Badge } from "@/components/ui/badge";
import { BasePageComponent } from "@/components/ui/base-page";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ToastContent } from "@/components/ui/toast-content";
import {
	addBonusToSlipFn,
	approvePayrollSlipFn,
	cancelPayrollSlipFn,
} from "@/features/payroll/services/payroll-slips.api";
import { payrollPeriodQueries, payrollSlipQueries } from "@/features/payroll/services/queries";
import { PAYROLL_PERIOD_STATUS } from "@/features/payroll/lib/payroll-constants";
import { currencyFormatter } from "@/lib/helpers";

const routeApi = getRouteApi("/app/payroll/slips/$slipId");

function amount(value: number | null | undefined) {
	if (value === null || value === undefined) {
		return "-";
	}

	return currencyFormatter(value);
}

function Row({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-md border bg-card p-4">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className="mt-2 font-semibold">{value}</p>
		</div>
	);
}

export function PayrollSlipDetailPage() {
	const queryClient = useQueryClient();
	const { slipId } = routeApi.useParams();
	const { data: slip } = useSuspenseQuery(payrollSlipQueries.detail({ slipId }));
	const { data: period } = useSuspenseQuery(
		payrollPeriodQueries.detail({ periodId: slip.payrollPeriodId })
	);
	const { data: history } = useSuspenseQuery(
		payrollSlipQueries.history({ employeeId: slip.employeeId })
	);

	if (!period) {
		throw new Error("Payroll period not found.");
	}
	const [bonusForm, setBonusForm] = useState({
		bonusAmount: "",
		description: "",
		notes: "",
	});

	const invalidatePayroll = () => {
		queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
		queryClient.invalidateQueries({ queryKey: ["payroll-slips"] });
	};

	const approveMutation = useMutation({
		mutationFn: async () => approvePayrollSlipFn({ data: { slipId } }),
		onSuccess: (result) => {
			if (!result.success) {
				throw new Error(result.error.message);
			}

			invalidatePayroll();
		},
		onError: (error) => {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to approve slip"}
				/>
			));
		},
	});

	const cancelMutation = useMutation({
		mutationFn: async () => {
			const reason = window.prompt("Cancellation reason");

			if (!reason) {
				throw new Error("Cancellation reason is required.");
			}

			return cancelPayrollSlipFn({
				data: {
					slipId,
					reason,
				},
			});
		},
		onSuccess: (result) => {
			if (!result.success) {
				throw new Error(result.error.message);
			}

			invalidatePayroll();
		},
		onError: (error) => {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to cancel slip"}
				/>
			));
		},
	});

	const bonusMutation = useMutation({
		mutationFn: async () =>
			addBonusToSlipFn({
				data: {
					slipId,
					bonusAmount: Number(bonusForm.bonusAmount),
					description: bonusForm.description,
					notes: bonusForm.notes || null,
				},
			}),
		onSuccess: (result) => {
			if (!result.success) {
				throw new Error(result.error.message);
			}

			invalidatePayroll();
			setBonusForm({
				bonusAmount: "",
				description: "",
				notes: "",
			});
		},
		onError: (error) => {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to add bonus"}
				/>
			));
		},
	});

	return (
		<BasePageComponent
			pageTitle={`${slip.employeeName} Payroll Slip`}
			pageDescription={`Detailed payroll computation for ${period.name}.`}
			extraActionButtons={<BackLink href="/app/payroll/periods">Back to Periods</BackLink>}
		>
			<div className="space-y-6">
				<div className="flex flex-wrap items-center gap-3">
					<Badge variant={slip.status === "approved" ? "success" : slip.status === "cancelled" ? "destructive" : "secondary"}>
						{slip.status}
					</Badge>
					<Badge variant={slip.isProrated ? "warning" : "secondary"}>
						{slip.isProrated ? "Prorated" : "Full month"}
					</Badge>
				</div>

				<div className="grid gap-4 lg:grid-cols-4">
					<Row label="Gross Pay" value={amount(slip.grossPay)} />
					<Row label="Net Pay" value={amount(slip.netPay)} />
					<Row label="PAYE" value={amount(slip.netPaye)} />
					<Row label="Employer Cost" value={amount(slip.totalEmployerCost)} />
				</div>

				{period.status === PAYROLL_PERIOD_STATUS.PROCESSING ? (
					<PermissionGate permissions={["payroll-process:create"]}>
						<div className="rounded-md border bg-card p-5 space-y-4">
							<h2 className="text-lg font-semibold">Slip Actions</h2>
							<div className="flex flex-wrap gap-2">
								{slip.status === "draft" ? (
									<Button type="button" onClick={() => approveMutation.mutate()}>
										Approve Slip
									</Button>
								) : null}
								{slip.status !== "cancelled" ? (
									<Button type="button" variant="destructive" onClick={() => cancelMutation.mutate()}>
										Cancel Slip
									</Button>
								) : null}
							</div>
							<form
								className="grid gap-3 lg:grid-cols-4"
								onSubmit={(event) => {
									event.preventDefault();
									bonusMutation.mutate();
								}}
							>
								<input
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									type="number"
									step="0.01"
									placeholder="Bonus amount"
									value={bonusForm.bonusAmount}
									onChange={(event) =>
										setBonusForm((current) => ({
											...current,
											bonusAmount: event.target.value,
										}))
									}
								/>
								<input
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									placeholder="Description"
									value={bonusForm.description}
									onChange={(event) =>
										setBonusForm((current) => ({
											...current,
											description: event.target.value,
										}))
									}
								/>
								<input
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									placeholder="Notes"
									value={bonusForm.notes}
									onChange={(event) =>
										setBonusForm((current) => ({ ...current, notes: event.target.value }))
									}
								/>
								<Button type="submit" disabled={bonusMutation.isPending}>
									Add Bonus
								</Button>
							</form>
						</div>
					</PermissionGate>
				) : null}

				<div className="grid gap-6 xl:grid-cols-2">
					<div className="rounded-md border bg-card p-5 space-y-4">
						<h2 className="text-lg font-semibold">Earnings Snapshot</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							<Row label="Basic Salary" value={amount(slip.basicSalary)} />
							<Row label="House Allowance" value={amount(slip.houseAllowance)} />
							<Row label="Transport Allowance" value={amount(slip.transportAllowance)} />
							<Row label="Commuter Allowance" value={amount(slip.commuterAllowance)} />
							<Row label="Meal Allowance" value={amount(slip.mealAllowance)} />
							<Row label="Airtime Allowance" value={amount(slip.airtimeAllowance)} />
							<Row label="Other Allowances" value={amount(slip.otherAllowances)} />
							<Row label="Overtime Pay" value={amount(slip.overtimePay)} />
							<Row label="Bonuses" value={amount(slip.bonuses)} />
							<Row label="Full Month Gross" value={amount(slip.fullMonthGrossPay)} />
							<Row label="Leave Deduction" value={amount(slip.leaveDeductionAmount)} />
							<Row label="Gross After Leave" value={amount(slip.grossPay)} />
						</div>
					</div>

					<div className="rounded-md border bg-card p-5 space-y-4">
						<h2 className="text-lg font-semibold">Statutory Breakdown</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							<Row label="NSSF Employee" value={amount(slip.nssfEmployee)} />
							<Row label="NSSF Employer" value={amount(slip.nssfEmployer)} />
							<Row label="SHIF Employee" value={amount(slip.shifEmployee)} />
							<Row label="SHIF Employer" value={amount(slip.shifEmployer)} />
							<Row label="AHL Employee" value={amount(slip.ahlEmployee)} />
							<Row label="AHL Employer" value={amount(slip.ahlEmployer)} />
							<Row label="Taxable Income" value={amount(slip.taxableIncome)} />
							<Row label="Gross Tax" value={amount(slip.grossTax)} />
							<Row label="Personal Relief" value={amount(slip.personalRelief)} />
							<Row label="Insurance Relief" value={amount(slip.insuranceRelief)} />
							<Row label="Net PAYE" value={amount(slip.netPaye)} />
							<Row label="NITA Levy" value={amount(slip.nitaLevy)} />
						</div>
					</div>
				</div>

				<div className="rounded-md border bg-card p-5 space-y-4">
					<h2 className="text-lg font-semibold">Proration and Deductions</h2>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<Row
							label="Proration Window"
							value={
								slip.isProrated
									? `${slip.proratedDays}/${slip.totalWorkingDaysInPeriod} days`
									: "Full month"
							}
						/>
						<Row label="Proration Reason" value={slip.proratedReason ?? "-"} />
						<Row label="HELB" value={amount(slip.helbDeduction)} />
						<Row label="Two-Thirds Cap" value={slip.twoThirdsCapApplied ? amount(slip.twoThirdsCapAmount) : "Not applied"} />
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b text-left">
									<th className="py-2">Type</th>
									<th className="py-2">Description</th>
									<th className="py-2">Amount</th>
								</tr>
							</thead>
							<tbody>
								{slip.deductions.map((deduction) => (
									<tr key={deduction.id} className="border-b last:border-b-0">
										<td className="py-2">{deduction.deductionType}</td>
										<td className="py-2">{deduction.description}</td>
										<td className="py-2">{amount(deduction.amount)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="rounded-md border bg-card p-5 space-y-4">
					<h2 className="text-lg font-semibold">PAYE Band Breakdown</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b text-left">
									<th className="py-2">Lower</th>
									<th className="py-2">Upper</th>
									<th className="py-2">Rate</th>
									<th className="py-2">Taxable</th>
									<th className="py-2">Tax</th>
								</tr>
							</thead>
							<tbody>
								{slip.payeBandBreakdown.map((band: any, index: number) => (
									<tr key={`${band.lowerBound}-${index}`} className="border-b last:border-b-0">
										<td className="py-2">{amount(band.lowerBound)}</td>
										<td className="py-2">{band.upperBound === null ? "Above" : amount(band.upperBound)}</td>
										<td className="py-2">{(band.rate * 100).toFixed(2)}%</td>
										<td className="py-2">{amount(band.taxableAmount)}</td>
										<td className="py-2">{amount(band.taxAmount)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="rounded-md border bg-card p-5 space-y-4">
					<h2 className="text-lg font-semibold">Payroll History</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b text-left">
									<th className="py-2">Period</th>
									<th className="py-2">Gross</th>
									<th className="py-2">Net</th>
									<th className="py-2">PAYE</th>
									<th className="py-2">Proration</th>
								</tr>
							</thead>
							<tbody>
								{history.map((item) => (
									<tr key={item.slipId} className="border-b last:border-b-0">
										<td className="py-2">{item.periodName}</td>
										<td className="py-2">{amount(item.grossPay)}</td>
										<td className="py-2">{amount(item.netPay)}</td>
										<td className="py-2">{amount(item.totalPaye)}</td>
										<td className="py-2">
											{item.isProrated ? amount(item.fullMonthGrossPay) : "Full month"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</BasePageComponent>
	);
}
