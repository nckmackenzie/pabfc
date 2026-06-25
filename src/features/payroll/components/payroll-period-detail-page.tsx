import { useEffect, useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BackLink } from "@/components/ui/links";
import { Badge } from "@/components/ui/badge";
import { BasePageComponent } from "@/components/ui/base-page";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ToastContent } from "@/components/ui/toast-content";
import {
	addPayrollPeriodBonusFn,
	addPayrollPeriodOtherDeductionFn,
	approvePayrollSlipFn,
	cancelPayrollSlipFn,
} from "@/features/payroll/services/payroll-slips.api";
import {
	postSalaryDisbursementJournalFn,
	postStatutoryRemittanceJournalFn,
	type PayrollJournalSummary,
} from "@/features/payroll/services/payroll-journals.api";
import {
	runPayrollPeriodPreflightFn,
	transitionPayrollPeriodFn,
	type PayrollPeriodPreflightReport,

} from "@/features/payroll/services/payroll-periods.api";
import {
	PAYROLL_PERIOD_STATUS,
	PAYROLL_REMITTANCE_ITEM_TYPES,
	type PayrollRemittanceItemType,
} from "@/features/payroll/lib/payroll-constants";
import { payrollPeriodQueries, payrollSlipQueries } from "@/features/payroll/services/queries";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { PayrollPeriodView } from "../lib/payroll-period/types";

const routeApi = getRouteApi("/app/payroll/periods/$periodId");

function formatAmount(value: number | null | undefined) {
	if (value === null || value === undefined) {
		return "-";
	}

	return currencyFormatter(value);
}

function statusBadge(status: PayrollPeriodView["status"]) {
	switch (status) {
		case "draft":
			return <Badge variant="secondary">Draft</Badge>;
		case "processing":
			return <Badge variant="warning">Processing</Badge>;
		case "approved":
			return <Badge variant="secondary">Approved</Badge>;
		case "paid":
			return <Badge variant="secondary">Paid</Badge>;
		case "closed":
			return <Badge variant="success">Closed</Badge>;
		case "cancelled":
			return <Badge variant="destructive">Cancelled</Badge>;
	}
}

function slipStatusBadge(status: "draft" | "approved" | "cancelled") {
	switch (status) {
		case "approved":
			return <Badge variant="success">Approved</Badge>;
		case "cancelled":
			return <Badge variant="destructive">Cancelled</Badge>;
		default:
			return <Badge variant="secondary">Draft</Badge>;
	}
}

function SummaryStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border bg-card p-4">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className="mt-2 text-lg font-semibold">{value}</p>
		</div>
	);
}

type RemittanceSelectionState = Record<
	PayrollRemittanceItemType,
	{
		selected: boolean;
		amount: string;
	}
>;

function createRemittanceSelectionState(summary: PayrollJournalSummary): RemittanceSelectionState {
	return Object.fromEntries(
		PAYROLL_REMITTANCE_ITEM_TYPES.map((type) => {
			const item = summary.remittanceCompletionStatus.items.find((entry) => entry.type === type);

			return [
				type,
				{
					selected: false,
					amount: item ? String(item.outstandingAmount) : "0",
				},
			];
		})
	) as RemittanceSelectionState;
}

export function PayrollPeriodDetailPage() {
	const queryClient = useQueryClient();
	const { periodId } = routeApi.useParams();
	const { data: period } = useSuspenseQuery(payrollPeriodQueries.detail({ periodId }));
	const { data: slips } = useSuspenseQuery(
		payrollSlipQueries.period({ payrollPeriodId: periodId })
	);
	const { data: departmentSummary } = useSuspenseQuery(
		payrollSlipQueries.departmentSummary({ payrollPeriodId: periodId })
	);
	const { data: journalSummary } = useSuspenseQuery(
		payrollPeriodQueries.journalSummary({ periodId })
	);
	const { data: journalPostingOptions } = useSuspenseQuery(
		payrollPeriodQueries.journalPostingOptions()
	);
	const { data: adjustmentOptions } = useSuspenseQuery(
		payrollSlipQueries.adjustmentOptions({ payrollPeriodId: periodId })
	);

	if (!period) {
		throw new Error("Payroll period not found.");
	}
	const [preflightReport, setPreflightReport] = useState<PayrollPeriodPreflightReport | null>(null);
	const [disbursementForm, setDisbursementForm] = useState({
		disbursementDate: period.payDate,
		disbursementAccountId: journalPostingOptions.disbursementAccounts[0]?.id.toString() ?? "",
		notes: "",
	});
	const [remittanceDate, setRemittanceDate] = useState(dateFormat(new Date()));
	const [remittanceAccountId, setRemittanceAccountId] = useState(
		journalPostingOptions.disbursementAccounts[0]?.id.toString() ?? ""
	);
	const [remittanceNotes, setRemittanceNotes] = useState("");
	const [remittanceSelections, setRemittanceSelections] = useState<RemittanceSelectionState>(
		createRemittanceSelectionState(journalSummary)
	);
	const [bonusForm, setBonusForm] = useState({
		employeeId: adjustmentOptions.employees[0]?.id ?? "",
		amount: "",
		description: "",
		notes: "",
	});
	const [deductionForm, setDeductionForm] = useState({
		employeeId: adjustmentOptions.employees[0]?.id ?? "",
		deductionType: "sacco",
		amount: "",
		description: "",
		notes: "",
	});

	const invalidatePayroll = () => {
		queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
		queryClient.invalidateQueries({ queryKey: ["payroll-slips"] });
	};

	useEffect(() => {
		setRemittanceSelections(createRemittanceSelectionState(journalSummary));
	}, [journalSummary]);

	useEffect(() => {
		const defaultAccountId = journalPostingOptions.disbursementAccounts[0]?.id.toString() ?? "";

		setDisbursementForm((current) =>
			current.disbursementAccountId
				? current
				: { ...current, disbursementAccountId: defaultAccountId }
		);
		setRemittanceAccountId((current) => current || defaultAccountId);
	}, [journalPostingOptions.disbursementAccounts]);

	const preflightMutation = useMutation({
		mutationFn: async () => runPayrollPeriodPreflightFn({ data: { periodId } }),
		onSuccess: (result) => {
			setPreflightReport(result);
		},
		onError: (error) => {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to run preflight"}
				/>
			));
		},
	});

	const transitionMutation = useMutation({
		mutationFn: async (targetStatus: PayrollPeriodView["status"]) => {
			const result = await transitionPayrollPeriodFn({
				data: {
					periodId,
					targetStatus,
					cancellationReason: null,
				},
			});
			if (!result.success) throw new Error(result.error.message);

			return result.data;
		},
		onSuccess: () => {
			invalidatePayroll();
		},
		onError: (error) => {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to transition period"}
				/>
			));
		},
	});

	const disbursementMutation = useMutation({
		mutationFn: async () => {
			const result = await postSalaryDisbursementJournalFn({
				data: {
					periodId,
					disbursementDate: disbursementForm.disbursementDate,
					disbursementAccountId: Number(disbursementForm.disbursementAccountId),
					notes: disbursementForm.notes || null,
				},
			});
			if (!result.success) throw new Error(result.error.message);

			return result.data;
		},
		onSuccess: (result) => {
			invalidatePayroll();
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Success"
					message={`Recorded salary disbursement of ${formatAmount(result.amountPosted)}.`}
				/>
			));
		},
		onError: (error) => {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to record salary disbursement"}
				/>
			));
		},
	});

	const remittanceMutation = useMutation({
		mutationFn: async () => {
			const remittedItems = PAYROLL_REMITTANCE_ITEM_TYPES.flatMap((type) => {
				const selection = remittanceSelections[type];

				if (!selection.selected) {
					return [];
				}

				return [
					{
						type,
						amountRemitted: Number(selection.amount),
					},
				];
			});

			if (remittedItems.length === 0) {
				throw new Error("Select at least one statutory item to remit.");
			}

			const result = await postStatutoryRemittanceJournalFn({
				data: {
					periodId,
					remittanceDate,
					remittanceAccountId: Number(remittanceAccountId),
					remittedItems,
					notes: remittanceNotes || null,
				},
			});

			if (!result.success) throw new Error(result.error.message);

			return result.data;
		},
		onSuccess: (result) => {
			invalidatePayroll();
			setRemittanceDate(dateFormat(new Date()));
			setRemittanceNotes("");
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Success"
					message={`Recorded statutory remittance of ${formatAmount(result.amountPosted)}.`}
				/>
			));
		},
		onError: (error) => {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to record statutory remittance"}
				/>
			));
		},
	});

	const bonusMutation = useMutation({
		mutationFn: async () => {
			const result = await addPayrollPeriodBonusFn({
				data: {
					payrollPeriodId: periodId,
					employeeId: bonusForm.employeeId,
					amount: Number(bonusForm.amount),
					description: bonusForm.description,
					notes: bonusForm.notes || null,
				},
			});

			if (!result.success) throw new Error(result.error.message);

			return result.data;
		},
		onSuccess: () => {
			invalidatePayroll();
			setBonusForm((current) => ({
				...current,
				amount: "",
				description: "",
				notes: "",
			}));
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

	const deductionMutation = useMutation({
		mutationFn: async () => {
			const result = await addPayrollPeriodOtherDeductionFn({
				data: {
					payrollPeriodId: periodId,
					employeeId: deductionForm.employeeId,
					deductionType: deductionForm.deductionType as
						| "sacco"
						| "union_dues"
						| "court_order"
						| "insurance"
						| "welfare"
						| "other",
					amount: Number(deductionForm.amount),
					description: deductionForm.description,
					notes: deductionForm.notes || null,
				},
			});

			if (!result.success) throw new Error(result.error.message);

			return result.data;
		},
		onSuccess: () => {
			invalidatePayroll();
			setDeductionForm((current) => ({
				...current,
				amount: "",
				description: "",
				notes: "",
			}));
		},
		onError: (error) => {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to add deduction"}
				/>
			));
		},
	});

	const approveSlipMutation = useMutation({
		mutationFn: async (slipId: string) => {
			const result = await approvePayrollSlipFn({ data: { slipId } });

			if (!result.success) throw new Error(result.error.message);

			return result.data;
		},
		onSuccess: () => {
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

	const cancelSlipMutation = useMutation({
		mutationFn: async (slipId: string) => {
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

	return (
		<BasePageComponent
			pageTitle={period.name}
			pageDescription="Inspect payroll run output, adjustments, and employee slips for this period."
			extraActionButtons={<BackLink href="/app/payroll/periods">Back to Periods</BackLink>}
		>
			<div className="space-y-6">
				<div className="grid gap-4 lg:grid-cols-4">
					<SummaryStat label="Status" value={period.status} />
					<SummaryStat label="Employees Processed" value={String(period.employeeCount ?? 0)} />
					<SummaryStat label="Gross Pay" value={formatAmount(period.totalGrossPay)} />
					<SummaryStat label="Net Pay" value={formatAmount(period.totalNetPay)} />
				</div>

				<div className="rounded-md border bg-card p-5 space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold">Run Overview</h2>
							<p className="text-sm text-muted-foreground">
								{period.periodStart} to {period.periodEnd} with pay date {period.payDate}
							</p>
						</div>
						{statusBadge(period.status)}
					</div>

					<PermissionGate permissions={["payroll-periods:transition"]}>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								disabled={preflightMutation.isPending}
								onClick={() => preflightMutation.mutate()}
							>
								Run Preflight
							</Button>
							{period.status === PAYROLL_PERIOD_STATUS.DRAFT ? (
								<Button
									type="button"
									disabled={transitionMutation.isPending}
									onClick={() => transitionMutation.mutate(PAYROLL_PERIOD_STATUS.PROCESSING)}
								>
									Start Processing
								</Button>
							) : null}
							{period.status === PAYROLL_PERIOD_STATUS.PROCESSING ? (
								<Button
									type="button"
									disabled={transitionMutation.isPending}
									onClick={() => transitionMutation.mutate(PAYROLL_PERIOD_STATUS.APPROVED)}
								>
									Approve Period
								</Button>
							) : null}
							{period.status === PAYROLL_PERIOD_STATUS.APPROVED ? (
								<Button
									type="button"
									disabled={
										transitionMutation.isPending || journalSummary.disbursementJournal === null
									}
									onClick={() => transitionMutation.mutate(PAYROLL_PERIOD_STATUS.PAID)}
								>
									Mark Paid
								</Button>
							) : null}
							{period.status === PAYROLL_PERIOD_STATUS.PAID ? (
								<Button
									type="button"
									disabled={transitionMutation.isPending || !journalSummary.allJournalsComplete}
									onClick={() => transitionMutation.mutate(PAYROLL_PERIOD_STATUS.CLOSED)}
								>
									Close Period
								</Button>
							) : null}
						</div>
					</PermissionGate>

					{preflightReport ? (
						<div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
							<p className="font-medium">
								{preflightReport.canProceed ? "Preflight ready" : "Preflight blocked"}
							</p>
							{preflightReport.errors.length > 0 ? (
								<p className="text-red-700">{preflightReport.errors.join(" ")}</p>
							) : null}
							{preflightReport.warnings.length > 0 ? (
								<p className="text-amber-700">{preflightReport.warnings.join(" ")}</p>
							) : null}
						</div>
					) : null}

					{period.processingWarnings.length > 0 ? (
						<div className="rounded-md border border-amber-200 bg-amber-50 p-4">
							<p className="font-medium text-amber-900">Processing Warnings</p>
							<ul className="mt-2 space-y-1 text-sm text-amber-900">
								{period.processingWarnings.map((warning) => (
									<li key={`${warning.employeeId}-${warning.message}`}>
										{warning.employeeName}: {warning.message}
									</li>
								))}
							</ul>
						</div>
					) : null}

					{period.skippedEmployees.length > 0 ? (
						<div className="rounded-md border border-blue-200 bg-blue-50 p-4">
							<p className="font-medium text-blue-900">Skipped Employees</p>
							<ul className="mt-2 space-y-1 text-sm text-blue-900">
								{period.skippedEmployees.map((employee) => (
									<li key={employee.employeeId}>
										{employee.employeeName}: {employee.reason}
									</li>
								))}
							</ul>
						</div>
					) : null}
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<div className="rounded-md border bg-card p-5 space-y-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<h2 className="text-lg font-semibold">Journal Status</h2>
								<p className="text-sm text-muted-foreground">
									Track payroll recognition, disbursement, and remittance posting.
								</p>
							</div>
							<Badge variant={journalSummary.allJournalsComplete ? "success" : "warning"}>
								{journalSummary.allJournalsComplete ? "Complete" : "Pending"}
							</Badge>
						</div>

						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-md border bg-muted/30 p-4">
								<p className="text-sm font-medium">Recognition</p>
								<p className="mt-2 text-sm text-muted-foreground">
									{journalSummary.recognitionJournal
										? `Posted ${journalSummary.recognitionJournal.postedAt}`
										: "Not posted"}
								</p>
								{journalSummary.recognitionJournal ? (
									<p className="mt-2 text-sm">
										DR {formatAmount(journalSummary.recognitionJournal.totalDebits)} / CR{" "}
										{formatAmount(journalSummary.recognitionJournal.totalCredits)}
									</p>
								) : null}
							</div>

							<div className="rounded-md border bg-muted/30 p-4">
								<p className="text-sm font-medium">Disbursement</p>
								<p className="mt-2 text-sm text-muted-foreground">
									{journalSummary.disbursementJournal
										? `Posted ${journalSummary.disbursementJournal.postedAt}`
										: "Not posted"}
								</p>
								{journalSummary.disbursementJournal ? (
									<p className="mt-2 text-sm">
										{formatAmount(journalSummary.disbursementJournal.amount)} via{" "}
										{journalSummary.disbursementJournal.disbursementAccount?.name ??
											"Unknown account"}
									</p>
								) : null}
							</div>

							<div className="rounded-md border bg-muted/30 p-4">
								<p className="text-sm font-medium">Remittance</p>
								<p className="mt-2 text-sm text-muted-foreground">
									{journalSummary.remittanceJournals.length > 0
										? `${journalSummary.remittanceJournals.length} journal(s) posted`
										: "No remittance journals posted"}
								</p>
								<p className="mt-2 text-sm">
									{journalSummary.remittanceCompletionStatus.isFullyRemitted
										? "All statutory items fully remitted"
										: "Outstanding statutory balances remain"}
								</p>
							</div>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b text-left">
										<th className="py-2">Item</th>
										<th className="py-2">Required</th>
										<th className="py-2">Remitted</th>
										<th className="py-2">Outstanding</th>
									</tr>
								</thead>
								<tbody>
									{journalSummary.remittanceCompletionStatus.items.map((item) => (
										<tr key={item.type} className="border-b last:border-b-0">
											<td className="py-2 uppercase">{item.type}</td>
											<td className="py-2">{formatAmount(item.requiredAmount)}</td>
											<td className="py-2">{formatAmount(item.remittedAmount)}</td>
											<td className="py-2">{formatAmount(item.outstandingAmount)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					<div className="rounded-md border bg-card p-5 space-y-4">
						<h2 className="text-lg font-semibold">Payroll Journal Actions</h2>

						<PermissionGate permissions={["payroll-periods:transition"]}>
							<div className="space-y-5">
								<div className="rounded-md border p-4 space-y-3">
									<div>
										<p className="font-medium">Salary Disbursement</p>
										<p className="text-sm text-muted-foreground">
											Record the actual salary payment before marking the period as paid.
										</p>
									</div>

									<div className="grid gap-3 md:grid-cols-2">
										<input
											className="border-input bg-background rounded-md border px-3 py-2 text-sm"
											type="date"
											value={disbursementForm.disbursementDate}
											onChange={(event) =>
												setDisbursementForm((current) => ({
													...current,
													disbursementDate: event.target.value,
												}))
											}
										/>
										<select
											className="border-input bg-background rounded-md border px-3 py-2 text-sm"
											value={disbursementForm.disbursementAccountId}
											onChange={(event) =>
												setDisbursementForm((current) => ({
													...current,
													disbursementAccountId: event.target.value,
												}))
											}
										>
											<option value="">Select account</option>
											{journalPostingOptions.disbursementAccounts.map((account) => (
												<option key={account.id} value={account.id}>
													{account.code ? `${account.code} - ` : ""}
													{account.name}
												</option>
											))}
										</select>
									</div>

									<textarea
										className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
										placeholder="Notes"
										value={disbursementForm.notes}
										onChange={(event) =>
											setDisbursementForm((current) => ({
												...current,
												notes: event.target.value,
											}))
										}
									/>

									<Button
										type="button"
										disabled={
											disbursementMutation.isPending ||
											period.status !== PAYROLL_PERIOD_STATUS.APPROVED ||
											journalSummary.disbursementJournal !== null ||
											disbursementForm.disbursementAccountId === ""
										}
										onClick={() => disbursementMutation.mutate()}
									>
										Record Disbursement
									</Button>
								</div>

								<div className="rounded-md border p-4 space-y-3">
									<div>
										<p className="font-medium">Statutory Remittance</p>
										<p className="text-sm text-muted-foreground">
											Record one or more remitted statutory items for this period.
										</p>
									</div>

									<div className="grid gap-3 md:grid-cols-2">
										<input
											className="border-input bg-background rounded-md border px-3 py-2 text-sm"
											type="date"
											value={remittanceDate}
											onChange={(event) => setRemittanceDate(event.target.value)}
										/>
										<select
											className="border-input bg-background rounded-md border px-3 py-2 text-sm"
											value={remittanceAccountId}
											onChange={(event) => setRemittanceAccountId(event.target.value)}
										>
											<option value="">Select account</option>
											{journalPostingOptions.disbursementAccounts.map((account) => (
												<option key={account.id} value={account.id}>
													{account.code ? `${account.code} - ` : ""}
													{account.name}
												</option>
											))}
										</select>
									</div>

									<div className="space-y-2">
										{journalSummary.remittanceCompletionStatus.items.map((item) => (
											<label
												key={item.type}
												className="grid gap-3 rounded-md border p-3 md:grid-cols-[auto,1fr,160px]"
											>
												<div className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={remittanceSelections[item.type].selected}
														disabled={item.outstandingAmount <= 0}
														onChange={(event) =>
															setRemittanceSelections((current) => ({
																...current,
																[item.type]: {
																	...current[item.type],
																	selected: event.target.checked,
																},
															}))
														}
													/>
													<span className="uppercase">{item.type}</span>
												</div>
												<div className="text-sm text-muted-foreground">
													Outstanding: {formatAmount(item.outstandingAmount)}
												</div>
												<input
													className="border-input bg-background rounded-md border px-3 py-2 text-sm"
													type="number"
													step="0.01"
													min="0"
													value={remittanceSelections[item.type].amount}
													onChange={(event) =>
														setRemittanceSelections((current) => ({
															...current,
															[item.type]: {
																...current[item.type],
																amount: event.target.value,
															},
														}))
													}
												/>
											</label>
										))}
									</div>

									<textarea
										className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
										placeholder="Notes"
										value={remittanceNotes}
										onChange={(event) => setRemittanceNotes(event.target.value)}
									/>

									<Button
										type="button"
										disabled={
											remittanceMutation.isPending ||
											period.status !== PAYROLL_PERIOD_STATUS.PAID ||
											remittanceAccountId === ""
										}
										onClick={() => remittanceMutation.mutate()}
									>
										Record Remittance
									</Button>
								</div>
							</div>
						</PermissionGate>
					</div>
				</div>

				<div className="rounded-md border bg-card p-5">
					<h2 className="text-lg font-semibold">Department Summary</h2>
					<div className="mt-4 overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b text-left">
									<th className="py-2">Department</th>
									<th className="py-2">Employees</th>
									<th className="py-2">Prorated</th>
									<th className="py-2">Gross</th>
									<th className="py-2">Net</th>
									<th className="py-2">Employer Cost</th>
								</tr>
							</thead>
							<tbody>
								{departmentSummary.map((summary) => (
									<tr key={summary.departmentId ?? "none"} className="border-b last:border-b-0">
										<td className="py-2">{summary.departmentName ?? "Unassigned"}</td>
										<td className="py-2">{summary.employeeCount}</td>
										<td className="py-2">{summary.proratedEmployeeCount}</td>
										<td className="py-2">{formatAmount(summary.totalGrossPay)}</td>
										<td className="py-2">{formatAmount(summary.totalNetPay)}</td>
										<td className="py-2">{formatAmount(summary.totalEmployerCost)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<div className="rounded-md border bg-card p-5 space-y-4">
						<h2 className="text-lg font-semibold">Period Bonuses</h2>
						<PermissionGate permissions={["payroll-process:create"]}>
							<form
								className="grid gap-3"
								onSubmit={(event) => {
									event.preventDefault();
									bonusMutation.mutate();
								}}
							>
								<select
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									value={bonusForm.employeeId}
									onChange={(event) =>
										setBonusForm((current) => ({
											...current,
											employeeId: event.target.value,
										}))
									}
								>
									{adjustmentOptions.employees.map((employee) => (
										<option key={employee.id} value={employee.id}>
											{employee.fullName}
										</option>
									))}
								</select>
								<input
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									type="number"
									step="0.01"
									placeholder="Amount"
									value={bonusForm.amount}
									onChange={(event) =>
										setBonusForm((current) => ({ ...current, amount: event.target.value }))
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
								<textarea
									className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
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
						</PermissionGate>
						<div className="space-y-2 text-sm">
							{adjustmentOptions.bonuses.map((bonus) => (
								<div key={bonus.id} className="rounded-md border p-3">
									<p className="font-medium">
										{bonus.employeeName} • {formatAmount(bonus.amount)}
									</p>
									<p className="text-muted-foreground">{bonus.description}</p>
								</div>
							))}
						</div>
					</div>

					<div className="rounded-md border bg-card p-5 space-y-4">
						<h2 className="text-lg font-semibold">Other Deductions</h2>
						<PermissionGate permissions={["payroll-process:create"]}>
							<form
								className="grid gap-3"
								onSubmit={(event) => {
									event.preventDefault();
									deductionMutation.mutate();
								}}
							>
								<select
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									value={deductionForm.employeeId}
									onChange={(event) =>
										setDeductionForm((current) => ({
											...current,
											employeeId: event.target.value,
										}))
									}
								>
									{adjustmentOptions.employees.map((employee) => (
										<option key={employee.id} value={employee.id}>
											{employee.fullName}
										</option>
									))}
								</select>
								<select
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									value={deductionForm.deductionType}
									onChange={(event) =>
										setDeductionForm((current) => ({
											...current,
											deductionType: event.target.value,
										}))
									}
								>
									<option value="sacco">Sacco</option>
									<option value="union_dues">Union dues</option>
									<option value="court_order">Court order</option>
									<option value="insurance">Insurance</option>
									<option value="welfare">Welfare</option>
									<option value="other">Other</option>
								</select>
								<input
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									type="number"
									step="0.01"
									placeholder="Amount"
									value={deductionForm.amount}
									onChange={(event) =>
										setDeductionForm((current) => ({
											...current,
											amount: event.target.value,
										}))
									}
								/>
								<input
									className="border-input bg-background rounded-md border px-3 py-2 text-sm"
									placeholder="Description"
									value={deductionForm.description}
									onChange={(event) =>
										setDeductionForm((current) => ({
											...current,
											description: event.target.value,
										}))
									}
								/>
								<textarea
									className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
									placeholder="Notes"
									value={deductionForm.notes}
									onChange={(event) =>
										setDeductionForm((current) => ({ ...current, notes: event.target.value }))
									}
								/>
								<Button type="submit" disabled={deductionMutation.isPending}>
									Add Deduction
								</Button>
							</form>
						</PermissionGate>
						<div className="space-y-2 text-sm">
							{adjustmentOptions.otherDeductions.map((deduction) => (
								<div key={deduction.id} className="rounded-md border p-3">
									<p className="font-medium">
										{deduction.employeeName} • {formatAmount(deduction.amount)}
									</p>
									<p className="text-muted-foreground">
										{deduction.deductionType} • {deduction.description}
									</p>
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="rounded-md border bg-card p-5">
					<h2 className="text-lg font-semibold">Employee Slips</h2>
					<div className="mt-4 overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b text-left">
									<th className="py-2">Employee</th>
									<th className="py-2">Status</th>
									<th className="py-2">Gross</th>
									<th className="py-2">Net</th>
									<th className="py-2">Proration</th>
									<th className="py-2">Processed</th>
									<th className="py-2">Actions</th>
								</tr>
							</thead>
							<tbody>
								{slips.map((slip) => (
									<tr key={slip.id} className="border-b last:border-b-0">
										<td className="py-2">
											<div className="font-medium">{slip.employeeName}</div>
											<div className="text-muted-foreground">
												{slip.departmentName ?? "Unassigned"}
											</div>
										</td>
										<td className="py-2">{slipStatusBadge(slip.status)}</td>
										<td className="py-2">{formatAmount(slip.grossPay)}</td>
										<td className="py-2">{formatAmount(slip.netPay)}</td>
										<td className="py-2">
											{slip.isProrated
												? `${slip.proratedDays}/${slip.totalWorkingDaysInPeriod}`
												: "Full month"}
										</td>
										<td className="py-2">
											{slip.createdAt ? dateFormat(slip.createdAt, "long") : "-"}
										</td>
										<td className="py-2">
											<div className="flex flex-wrap gap-2">
												<Button variant="outline" asChild>
													<Link to="/app/payroll/slips/$slipId" params={{ slipId: slip.id }}>
														View Slip
													</Link>
												</Button>
												{period.status === PAYROLL_PERIOD_STATUS.PROCESSING ? (
													<PermissionGate permissions={["payroll-process:create"]}>
														<>
															{slip.status === "draft" ? (
																<Button
																	type="button"
																	size="sm"
																	onClick={() => approveSlipMutation.mutate(slip.id)}
																>
																	Approve
																</Button>
															) : null}
															{slip.status !== "cancelled" ? (
																<Button
																	type="button"
																	size="sm"
																	variant="destructive"
																	onClick={() => cancelSlipMutation.mutate(slip.id)}
																>
																	Cancel
																</Button>
															) : null}
														</>
													</PermissionGate>
												) : null}
											</div>
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
