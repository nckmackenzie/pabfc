import { useDeferredValue, useMemo, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { BasePageComponent } from "@/components/ui/base-page";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ToastContent } from "@/components/ui/toast-content";
import { getPayrollYearOptions } from "@/features/payroll/lib/overtime-options";
import { PAYROLL_PERIOD_STATUS } from "@/features/payroll/lib/payroll-constants";
import {
	createPayrollPeriodFn,
	runPayrollPeriodPreflightFn,
	transitionPayrollPeriodFn,
	type PayrollPeriodPreflightReport,
	type PayrollPeriodView,
} from "@/features/payroll/services/payroll-periods.api";
import { payrollPeriodCreateFormSchema } from "@/features/payroll/services/payroll-period.schemas";
import { payrollPeriodQueries } from "@/features/payroll/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

const statusLabelMap: Record<PayrollPeriodView["status"], string> = {
	draft: "Draft",
	processing: "Processing",
	approved: "Approved",
	paid: "Paid",
	closed: "Closed",
	cancelled: "Cancelled",
};

const transitionButtonCopy: Record<PayrollPeriodView["status"], string> = {
	draft: "Return to Draft",
	processing: "Start Processing",
	approved: "Approve Period",
	paid: "Mark as Paid",
	closed: "Close Period",
	cancelled: "Cancel Period",
};

const statusOptions = [
	{ value: PAYROLL_PERIOD_STATUS.DRAFT, label: "Draft" },
	{ value: PAYROLL_PERIOD_STATUS.PROCESSING, label: "Processing" },
	{ value: PAYROLL_PERIOD_STATUS.APPROVED, label: "Approved" },
	{ value: PAYROLL_PERIOD_STATUS.PAID, label: "Paid" },
	{ value: PAYROLL_PERIOD_STATUS.CLOSED, label: "Closed" },
	{ value: PAYROLL_PERIOD_STATUS.CANCELLED, label: "Cancelled" },
] as const;

const yearOptions = getPayrollYearOptions({
	startYear: 2020,
	endYear: new Date().getUTCFullYear() + 1,
});

function formatAmount(value: number | null | undefined) {
	if (value === null || value === undefined) {
		return "-";
	}

	return currencyFormatter(value);
}

function PayrollPeriodStatusBadge({ status }: { status: PayrollPeriodView["status"] }) {
	if (status === PAYROLL_PERIOD_STATUS.CLOSED) {
		return <Badge variant="success">Closed</Badge>;
	}

	if (status === PAYROLL_PERIOD_STATUS.CANCELLED) {
		return <Badge variant="destructive">Cancelled</Badge>;
	}

	if (status === PAYROLL_PERIOD_STATUS.APPROVED || status === PAYROLL_PERIOD_STATUS.PAID) {
		return <Badge variant="secondary">{statusLabelMap[status]}</Badge>;
	}

	if (status === PAYROLL_PERIOD_STATUS.PROCESSING) {
		return <Badge variant="warning">Processing</Badge>;
	}

	return <Badge variant="secondary">Draft</Badge>;
}

function SummaryCard({
	label,
	value,
	description,
}: {
	label: string;
	value: string;
	description: string;
}) {
	return (
		<div className="rounded-md border bg-card p-5">
			<p className="text-sm font-medium text-muted-foreground">{label}</p>
			<p className="mt-2 text-2xl font-semibold">{value}</p>
			<p className="mt-2 text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

function PreflightReportCard({ report }: { report: PayrollPeriodPreflightReport }) {
	return (
		<div className="rounded-md border bg-card p-5 space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold">Latest Preflight Report</h2>
					<p className="text-sm text-muted-foreground">
						Review blocking issues and advisories before moving a period into processing.
					</p>
				</div>
				<Badge variant={report.canProceed ? "success" : "destructive"}>
					{report.canProceed ? "Ready" : "Blocked"}
				</Badge>
			</div>

			{report.errors.length > 0 ? (
				<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
					{report.errors.join(" ")}
				</div>
			) : null}

			{report.warnings.length > 0 ? (
				<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
					{report.warnings.join(" ")}
				</div>
			) : null}

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<SummaryCard
					label="Active Employees"
					value={String(report.summary.activeEmployeeCount)}
					description="Employees currently eligible for payroll."
				/>
				<SummaryCard
					label="Approved Overtime"
					value={String(report.summary.approvedOvertimeRecordCount)}
					description="Approved overtime records available for inclusion."
				/>
				<SummaryCard
					label="Active Loans"
					value={String(report.summary.activeLoansCount)}
					description="Loans expected to contribute repayment deductions."
				/>
				<SummaryCard
					label="Account Mapping"
					value={report.summary.accountMappingsComplete ? "Complete" : "Incomplete"}
					description="Posting configuration required for payroll journals."
				/>
			</div>
		</div>
	);
}

function PayrollPeriodCard({
	period,
	cancelDraft,
	isCancelOpen,
	isBusy,
	onCancelReasonChange,
	onRunPreflight,
	onToggleCancel,
	onTransition,
}: {
	period: PayrollPeriodView;
	cancelDraft: string;
	isCancelOpen: boolean;
	isBusy: boolean;
	onCancelReasonChange: (value: string) => void;
	onRunPreflight: () => void;
	onToggleCancel: () => void;
	onTransition: (targetStatus: PayrollPeriodView["status"], cancellationReason?: string) => void;
}) {
	const isOverdue =
		period.daysUntilRemittanceDeadline < 0 && period.remittanceJournalEntryId === null;

	return (
		<div className="rounded-md border bg-card p-5 space-y-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<h2 className="text-lg font-semibold">{period.name}</h2>
						<PayrollPeriodStatusBadge status={period.status} />
						{isOverdue ? <Badge variant="destructive">Remittance Overdue</Badge> : null}
					</div>
					<p className="text-sm text-muted-foreground">
						{period.periodStart} to {period.periodEnd} • Pay date {period.payDate}
					</p>
					<p className="text-sm text-muted-foreground">
						Remittance deadline {period.statutoryRemittanceDeadline} ({period.daysUntilRemittanceDeadline} day(s))
					</p>
				</div>

				<div className="grid gap-3 sm:grid-cols-3">
					<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
						<p className="text-muted-foreground">Employees</p>
						<p className="font-semibold">{period.employeeCount ?? "-"}</p>
					</div>
					<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
						<p className="text-muted-foreground">Gross Pay</p>
						<p className="font-semibold">{formatAmount(period.totalGrossPay)}</p>
					</div>
					<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
						<p className="text-muted-foreground">Net Pay</p>
						<p className="font-semibold">{formatAmount(period.totalNetPay)}</p>
					</div>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
				<div className="rounded-md border p-3">
					<p className="text-muted-foreground">PAYE</p>
					<p className="font-semibold">{formatAmount(period.totalPaye)}</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-muted-foreground">NSSF Total</p>
					<p className="font-semibold">
						{formatAmount((period.totalNssfEmployee ?? 0) + (period.totalNssfEmployer ?? 0))}
					</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-muted-foreground">SHIF Total</p>
					<p className="font-semibold">
						{formatAmount((period.totalShifEmployee ?? 0) + (period.totalShifEmployer ?? 0))}
					</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-muted-foreground">AHL Total</p>
					<p className="font-semibold">
						{formatAmount((period.totalAhlEmployee ?? 0) + (period.totalAhlEmployer ?? 0))}
					</p>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
				<div className="rounded-md border p-3">
					<p className="text-muted-foreground">Processing Started</p>
					<p className="font-semibold">
						{period.processingStartedAt ? dateFormat(period.processingStartedAt, "long") : "-"}
					</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-muted-foreground">Processing Completed</p>
					<p className="font-semibold">
						{period.processingCompletedAt ? dateFormat(period.processingCompletedAt, "long") : "-"}
					</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-muted-foreground">Approved At</p>
					<p className="font-semibold">
						{period.approvedAt ? dateFormat(period.approvedAt, "long") : "-"}
					</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-muted-foreground">Closed At</p>
					<p className="font-semibold">
						{period.closedAt ? dateFormat(period.closedAt, "long") : "-"}
					</p>
				</div>
			</div>

			<PermissionGate permissions={["payroll-periods:transition"]}>
				<div className="flex flex-wrap gap-2">
					{period.status === PAYROLL_PERIOD_STATUS.DRAFT ? (
						<Button
							type="button"
							variant="outline"
							disabled={isBusy}
							onClick={onRunPreflight}
						>
							Run Preflight
						</Button>
					) : null}

					{period.allowedTransitions
						.filter((status) => status !== PAYROLL_PERIOD_STATUS.CANCELLED)
						.map((status) => (
							<Button
								key={status}
								type="button"
								disabled={isBusy}
								onClick={() => onTransition(status)}
							>
								{transitionButtonCopy[status]}
							</Button>
						))}

					{period.allowedTransitions.includes(PAYROLL_PERIOD_STATUS.CANCELLED) ? (
						<Button
						type="button"
						variant="destructive"
						disabled={isBusy}
						onClick={onToggleCancel}
					>
						{isCancelOpen ? "Hide Cancel" : "Cancel Period"}
					</Button>
				) : null}
			</div>
			</PermissionGate>

			{isCancelOpen ? (
				<div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
					<label className="block text-sm font-medium text-red-900" htmlFor={`cancel-${period.id}`}>
						Cancellation Reason
					</label>
					<textarea
						id={`cancel-${period.id}`}
						className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
						placeholder="Explain why this payroll period is being cancelled"
						value={cancelDraft}
						onChange={(event) => onCancelReasonChange(event.target.value)}
					/>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="destructive"
							disabled={isBusy || cancelDraft.trim() === ""}
							onClick={() =>
								onTransition(PAYROLL_PERIOD_STATUS.CANCELLED, cancelDraft.trim())
							}
						>
							Confirm Cancellation
						</Button>
						<Button type="button" variant="outline" disabled={isBusy} onClick={onToggleCancel}>
							Clear
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

export function PayrollPeriodsPage() {
	const queryClient = useQueryClient();
	const { filters, setFilters } = useFilters(getRouteApi("/app/payroll/periods").id);
	const deferredFilters = useDeferredValue(filters);
	const listFilters = useMemo(
		() => ({
			status: deferredFilters.status,
			year: deferredFilters.year,
		}),
		[deferredFilters.status, deferredFilters.year]
	);
	const { data: periods } = useSuspenseQuery(payrollPeriodQueries.list(listFilters));
	const { data: activePeriod } = useSuspenseQuery(payrollPeriodQueries.active());
	const ytdYear = filters.year ?? new Date().getUTCFullYear();
	const { data: ytdTotals } = useSuspenseQuery(payrollPeriodQueries.ytd({ year: ytdYear }));
	const [preflightReport, setPreflightReport] = useState<PayrollPeriodPreflightReport | null>(null);
	const [cancelOpenPeriodId, setCancelOpenPeriodId] = useState<string | null>(null);
	const [cancellationReasons, setCancellationReasons] = useState<Record<string, string>>({});

	const createMutation = useMutation({
		mutationFn: async (payload: {
			periodMonth: number;
			periodYear: number;
			payDate: string;
		}) => {
			const result = await createPayrollPeriodFn({ data: payload });

			if (!result.success) {
				throw new Error(result.error.message);
			}

			return result.data;
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
			toast.success((t) => (
				<ToastContent t={t} title="Success" message={`Created ${result.period.name}.`} />
			));
			if (result.warnings.length > 0) {
				toast.error((t) => (
					<ToastContent t={t} title="Advisory" message={result.warnings.join(" ")} />
				));
			}
			createForm.reset();
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : "Failed to create payroll period";
			toast.error((t) => <ToastContent t={t} title="Error" message={message} />);
		},
	});

	const transitionMutation = useMutation({
		mutationFn: async ({
			periodId,
			targetStatus,
			cancellationReason,
		}: {
			periodId: string;
			targetStatus: PayrollPeriodView["status"];
			cancellationReason?: string;
		}) => {
			const result = await transitionPayrollPeriodFn({
				data: {
					periodId,
					targetStatus,
					cancellationReason: cancellationReason ?? null,
				},
			});

			if (!result.success) {
				throw new Error(result.error.message);
			}

			return result.data;
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Success"
					message={`${result.name} moved to ${statusLabelMap[result.status]}.`}
				/>
			));
			setCancelOpenPeriodId(null);
			setCancellationReasons((current) => {
				const next = { ...current };
				delete next[result.id];
				return next;
			});
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : "Failed to transition payroll period";
			toast.error((t) => <ToastContent t={t} title="Error" message={message} />);
		},
	});

	const preflightMutation = useMutation({
		mutationFn: async (periodId: string) => runPayrollPeriodPreflightFn({ data: { periodId } }),
		onSuccess: (result) => {
			setPreflightReport(result);
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Preflight Complete"
					message={result.canProceed ? "Payroll period is ready for processing." : "Preflight found blocking issues."}
				/>
			));
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : "Failed to run preflight";
			toast.error((t) => <ToastContent t={t} title="Error" message={message} />);
		},
	});

	const createForm = useAppForm({
		defaultValues: {
			periodMonth: new Date().getUTCMonth() + 1,
			periodYear: new Date().getUTCFullYear(),
			payDate: dateFormat(new Date()),
		},
		validators: {
			onSubmit: payrollPeriodCreateFormSchema,
		},
		onSubmit: ({ value }) => createMutation.mutate(value),
	});

	return (
		<BasePageComponent
			pageTitle="Payroll Periods"
			pageDescription="Create monthly payroll periods, run preflight checks, and drive the payroll lifecycle from draft to closure."
			customFilters={
				<div className="grid gap-3 md:grid-cols-2">
					<select
						className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
						value={filters.status ?? "all"}
						onChange={(event) =>
							setFilters({
								status:
									event.target.value === "all"
										? undefined
										: (event.target.value as PayrollPeriodView["status"]),
							})
						}
					>
						<option value="all">All Statuses</option>
						{statusOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<select
						className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
						value={filters.year ? String(filters.year) : "all"}
						onChange={(event) =>
							setFilters({
								year: event.target.value === "all" ? undefined : Number(event.target.value),
							})
						}
					>
						<option value="all">All Years</option>
						{yearOptions.map((option) => (
							<option key={option.value} value={String(option.value)}>
								{option.label}
							</option>
						))}
					</select>
				</div>
			}
		>
			<div className="space-y-6">
				<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
					<PermissionGate permissions={["payroll-periods:create"]}>
						<div className="rounded-md border bg-card p-5 space-y-4">
							<div>
								<h2 className="text-lg font-semibold">Create Payroll Period</h2>
								<p className="text-sm text-muted-foreground">
									Periods are calendar-month records. Pay date can fall inside the month or within the first five days of the next month.
								</p>
							</div>
							<form
								className="space-y-4"
								onSubmit={(event) => {
									event.preventDefault();
									event.stopPropagation();
									createForm.handleSubmit();
								}}
							>
								<div className="grid gap-4 md:grid-cols-3">
									<createForm.AppField name="periodMonth">
										{(field) => (
											<field.Input
												label="Payroll Month"
												type="number"
												min={1}
												max={12}
												required
											/>
										)}
									</createForm.AppField>
									<createForm.AppField name="periodYear">
										{(field) => <field.Input label="Payroll Year" type="number" required />}
									</createForm.AppField>
									<createForm.AppField name="payDate">
										{(field) => <field.Input label="Pay Date" type="date" required />}
									</createForm.AppField>
								</div>
								<createForm.AppForm>
									<createForm.SubmitButton
										buttonText="Create Payroll Period"
										isLoading={createMutation.isPending}
										withReset
									/>
								</createForm.AppForm>
							</form>
						</div>
					</PermissionGate>

					<div className="grid gap-4">
						<SummaryCard
							label="Active Payroll Period"
							value={activePeriod?.name ?? "None"}
							description={
								activePeriod
									? `${statusLabelMap[activePeriod.status]} • Pay date ${activePeriod.payDate}`
									: "No open payroll period exists right now."
							}
						/>
						<SummaryCard
							label={`YTD Gross Pay (${ytdYear})`}
							value={formatAmount(ytdTotals.totalGrossPay)}
							description={`${ytdTotals.periodCount} closed period(s) included.`}
						/>
						<SummaryCard
							label={`YTD PAYE (${ytdYear})`}
							value={formatAmount(ytdTotals.totalPaye)}
							description="Closed periods only."
						/>
					</div>
				</div>

				{preflightReport ? <PreflightReportCard report={preflightReport} /> : null}

				<div className="space-y-4">
					{periods.length === 0 ? (
						<div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground">
							No payroll periods match the current filters.
						</div>
					) : (
						periods.map((period) => (
							<PayrollPeriodCard
								key={period.id}
								period={period}
								cancelDraft={cancelOpenPeriodId === period.id ? cancellationReasons[period.id] ?? "" : ""}
								isCancelOpen={cancelOpenPeriodId === period.id}
								isBusy={transitionMutation.isPending || preflightMutation.isPending}
								onCancelReasonChange={(value) =>
									setCancellationReasons((current) => ({
										...current,
										[period.id]: value,
									}))
								}
								onRunPreflight={() => preflightMutation.mutate(period.id)}
								onToggleCancel={() => {
									if (cancelOpenPeriodId === period.id) {
										setCancelOpenPeriodId(null);
										setCancellationReasons((current) => ({
											...current,
											[period.id]: "",
										}));
										return;
									}

									setCancelOpenPeriodId(period.id);
								}}
								onTransition={(targetStatus, cancellationReason) =>
									transitionMutation.mutate({
										periodId: period.id,
										targetStatus,
										cancellationReason,
									})
								}
							/>
						))
					)}
				</div>
			</div>
		</BasePageComponent>
	);
}
