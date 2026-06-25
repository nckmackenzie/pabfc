import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { payrollPeriodQueries } from "../../services/queries";
import { useParams } from "@tanstack/react-router";
import { PayrollPeriodStatusBadge } from "@/routes/app/payroll/periods";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { BackLink } from "@/components/ui/links";
import { PAYROLL_PERIOD_STATUS } from "../../lib/payroll-constants";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import {
	BadgeCheckIcon,
	CheckCheckIcon,
	CirclePercentIcon,
	CreditCardIcon,
	HandCoinsIcon,
	HouseIcon,
	ReceiptIcon,
	ScanSearchIcon,
	SearchXIcon,
	SquarePenIcon,
	UmbrellaIcon,
	Users2Icon,
	Wallet2Icon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CheckCircleIcon, CheckIcon, PercentBadgeIcon, XIcon } from "@/components/ui/icons";
import type { PayrollPeriodView } from "../../lib/payroll-period/types";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Badge } from "@/components/ui/badge";
import {
	type PayrollPeriodPreflightReport,
	recordDisbursementAndMarkPaidFn,
	runPayrollPeriodPreflightFn,
	transitionPayrollPeriodFn,
} from "../../services/payroll-periods.api";
import { ToastContent } from "@/components/ui/toast-content";
import toast from "react-hot-toast";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { BonusForm } from "./bonus-form";
import { PeriodDeductions } from "./deductions";
import { cn, toTitleCase } from "@/lib/utils";
import { useState } from "react";
import { useStore } from "@tanstack/react-form";
import { useModal } from "@/integrations/modal-provider";
import CustomModal from "@/components/ui/custom-modal";
import { useAppForm } from "@/lib/form";
import { salaryDisbursementJournalSchema } from "../../services/payroll-journal.schemas";
import type { z } from "zod";
import { PAYROLL_REMITTANCE_ITEM_TYPES } from "../../lib/payroll-constants";
import type { PayrollRemittanceItemType } from "../../lib/payroll-constants";
import { postStatutoryRemittanceJournalFn } from "../../services/payroll-journals.api";
import { FieldGroup } from "@/components/ui/field";
import { accountQueries } from "@/features/coa/services/queries";
import { SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { Progress } from "@/components/ui/progress";

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

export function PayrollPeriodDetail() {
	const { periodId } = useParams({ from: "/app/payroll/periods/$periodId/" });
	const { data } = useSuspenseQuery(payrollPeriodQueries.detail({ periodId }));
	return (
		<div className="space-y-6 bg-card p-6 rounded-md">
			<BackLink href="/app/payroll/periods">All Payroll Periods</BackLink>
			<PayrollPeriodHeader data={data} />
			<PeriodStats data={data} />
			{data.status !== PAYROLL_PERIOD_STATUS.CANCELLED ? (
				<>
					<BonusAndDeductions status={data.status} periodId={periodId} />
					<SalaryDisbursement
						periodId={periodId}
						status={data.status}
						totalNetPay={data.totalNetPay ?? 0}
						canPostDisbursement={!data.disbursementJournalEntryId}
						employeeCount={data.employeeCount ?? 0}
						payDate={data.payDate}
						periodName={data.name}
					/>
					<StatutoryRemittance periodId={periodId} status={data.status} />
				</>
			) : (
				<div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
					<p className="text-sm font-medium text-red-900">
						This payroll period has been cancelled.
					</p>
					<p className="text-sm text-muted-foreground">
						<strong>Reason:</strong> {data.cancellationReason}
					</p>
				</div>
			)}
		</div>
	);
}

function PayrollPeriodHeader({ data }: { data: PayrollPeriodView }) {
	const periodId = data.id;
	const queryClient = useQueryClient();
	const [isCancelOpen, setIsCancelOpen] = useState(false);
	const [cancelDraft, setCancelDraft] = useState<string>("");

	const preflightMutation = useMutation({
		mutationFn: async (periodId: string) => runPayrollPeriodPreflightFn({ data: { periodId } }),
		onSuccess: (result) => {
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Preflight Complete"
					message={
						result.canProceed
							? "Payroll period is ready for processing."
							: "Preflight found blocking issues."
					}
				/>
			));
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : "Failed to run preflight";
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
		},
		onError: (error) => {
			const message =
				error instanceof Error ? error.message : "Failed to transition payroll period";
			toast.error((t) => <ToastContent t={t} title="Error" message={message} />);
		},
	});

	const isBusy = preflightMutation.isPending || transitionMutation.isPending;

	return (
		<section className="space-y-6">
			<header className="flex flex-col gap-y-4 md:gap-y-0 md:flex-row md:justify-between md:items-center">
				<div className="space-y-1">
					<div className="flex gap-2 items-center">
						<h1 className="text-2xl font-semibold font-display">{data.name}</h1>
						<PayrollPeriodStatusBadge status={data.status} />
						{data.status === PAYROLL_PERIOD_STATUS.PAID && data.remittanceJournalEntryId && (
							<Badge variant="success">
								<BadgeCheckIcon className="size-3" />
								Ready for closure
							</Badge>
						)}
					</div>
					<p className="text-muted-foreground text-sm font-medium">
						Pay Date: {dateFormat(new Date(data.payDate), "long")}
					</p>
				</div>

				<div className="flex flex-col md:flex-row gap-2">
					{data.status === PAYROLL_PERIOD_STATUS.DRAFT && (
						<>
							<Button type="button" variant="outline" asChild>
								<Link to="/app/payroll/periods/$periodId/edit" params={{ periodId }}>
									<SquarePenIcon /> Edit Period
								</Link>
							</Button>
							<PermissionGate permissions={["payroll-periods:transition"]}>
								<Button
									type="button"
									variant="bordered"
									disabled={isBusy}
									onClick={() => preflightMutation.mutate(periodId)}
								>
									<LoadingSwap isLoading={preflightMutation.isPending}>
										<ScanSearchIcon />
										Run Preflight Checks
									</LoadingSwap>
								</Button>
							</PermissionGate>
						</>
					)}
					<PermissionGate permissions={["payroll-periods:transition"]}>
						{data.allowedTransitions
							.filter((status) => status !== PAYROLL_PERIOD_STATUS.CANCELLED)
							.map((status) => (
								<Button
									key={status}
									type="button"
									disabled={isBusy}
									onClick={() => {
										transitionMutation.mutate({ periodId, targetStatus: status });
									}}
								>
									<CheckIcon />
									{transitionButtonCopy[status]}
								</Button>
							))}
						{data.allowedTransitions.includes(PAYROLL_PERIOD_STATUS.CANCELLED) && (
							<Button
								type="button"
								variant="secondary"
								onClick={() => {
									setIsCancelOpen(true);
								}}
							>
								<XIcon />
								Cancel Period
							</Button>
						)}
					</PermissionGate>
				</div>
			</header>
			{isCancelOpen ? (
				<div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
					<label className="block text-sm font-medium text-red-900" htmlFor={`cancel-${data.id}`}>
						Cancellation Reason
					</label>
					<textarea
						id={`cancel-${data.id}`}
						className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
						placeholder="Explain why this payroll period is being cancelled"
						value={cancelDraft}
						onChange={(event) => setCancelDraft(event.target.value)}
					/>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="destructive"
							disabled={isBusy || cancelDraft.trim() === ""}
							onClick={() =>
								transitionMutation.mutate({
									periodId,
									targetStatus: PAYROLL_PERIOD_STATUS.CANCELLED,
									cancellationReason: cancelDraft.trim(),
								})
							}
						>
							Confirm Cancellation
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={isBusy}
							onClick={() => setIsCancelOpen(false)}
						>
							Clear
						</Button>
					</div>
				</div>
			) : null}
			{preflightMutation.data ? (
				<PreflightReportCard onReset={preflightMutation.reset} report={preflightMutation.data} />
			) : null}
		</section>
	);
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

function PreflightReportCard({
	report,
	onReset,
}: {
	report: PayrollPeriodPreflightReport;
	onReset: () => void;
}) {
	return (
		<div className="rounded-md border bg-card p-5 space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold">Latest Preflight Report</h2>
					<p className="text-sm text-muted-foreground">
						Review blocking issues and advisories before moving a period into processing.
					</p>
				</div>
				<div>
					<Badge variant={report.canProceed ? "success" : "secondary"}>
						{report.canProceed ? <CheckCircleIcon /> : <SearchXIcon />}
						{report.canProceed ? "Ready" : "Blocked"}
					</Badge>
					<Button variant="link" size="sm" onClick={onReset}>
						Dismiss Report
					</Button>
				</div>
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

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
					label="Advance Deduction"
					value={currencyFormatter(report.summary.totalAdvaceDeductable ?? 0)}
					description="Total Advance Deduction for the period."
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

function PeriodStats({ data }: { data: PayrollPeriodView }) {
	return (
		<section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
			<StatCard
				title="Employee Count"
				value={String(data.employeeCount ?? "-")}
				icon={Users2Icon}
			/>
			<StatCard
				title="Gross Pay"
				value={currencyFormatter(data.totalGrossPay ?? 0)}
				icon={Wallet2Icon}
			/>
			<StatCard
				title="Net Pay"
				value={currencyFormatter(data.totalNetPay ?? 0)}
				icon={HandCoinsIcon}
			/>
			<StatCard
				title="PAYE"
				value={currencyFormatter(data.totalPaye ?? 0)}
				icon={CirclePercentIcon}
			/>
			<StatCard
				title="NSSF"
				value={currencyFormatter((data.totalNssfEmployee ?? 0) + (data.totalNssfEmployer ?? 0))}
				icon={UmbrellaIcon}
			/>
			<StatCard
				title="SHIF"
				value={currencyFormatter((data.totalShifEmployee ?? 0) + (data.totalShifEmployer ?? 0))}
				icon={Users2Icon}
			/>
			<StatCard
				title="AFL"
				value={currencyFormatter((data.totalAhlEmployee ?? 0) + (data.totalAhlEmployer ?? 0))}
				icon={HouseIcon}
			/>
			<StatCard
				title="Other Deductions"
				value={currencyFormatter(data.totalOtherDeductions ?? 0)}
				icon={ReceiptIcon}
			/>
		</section>
	);
}

type StatCardProps = {
	title: string;
	icon: LucideIcon;
	value: string;
};

type PeriodIdStatus = {
	periodId: string;
	status: PayrollPeriodView["status"];
};

function StatCard({ title, icon: Icon, value }: StatCardProps) {
	return (
		<div className="flex items-center gap-3 px-6 py-5 border  rounded-md">
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info text-primary">
				<Icon className="h-5 w-5" />
			</span>
			<div className="min-w-0">
				<p className="text-xs font-medium text-muted-foreground">{title}</p>
				<p className="truncate text-base font-semibold text-foreground">{value}</p>
			</div>
		</div>
	);
}

function BonusAndDeductions({ periodId, status }: PeriodIdStatus) {
	return (
		<section className="grid md:grid-cols-2 gap-6">
			<BonusForm periodId={periodId} status={status} />
			<PeriodDeductions periodId={periodId} status={status} />
		</section>
	);
}

type SalaryDisbursementProps = PeriodIdStatus & {
	totalNetPay: number;
	canPostDisbursement: boolean;
	payDate: string;
	employeeCount: number;
	periodName: string;
};

function SalaryDisbursement({
	periodId,
	status,
	totalNetPay,
	canPostDisbursement,
	employeeCount,
	payDate,
	periodName,
}: SalaryDisbursementProps) {
	const { setOpen, setClose } = useModal();
	const preApproveState =
		status === PAYROLL_PERIOD_STATUS.DRAFT || status === PAYROLL_PERIOD_STATUS.PROCESSING;
	return (
		<section
			className={cn("p-5 border rounded-md", {
				"cursor-not-allowed opacity-70 border-dashed": preApproveState,
				"bg-toast-success border-toast-success-border":
					status === PAYROLL_PERIOD_STATUS.PAID || status === PAYROLL_PERIOD_STATUS.CLOSED,
			})}
		>
			{preApproveState && (
				<p className="text-sm text-muted-foreground block text-center">
					Salary disbursement unlocks once this period is approved.
				</p>
			)}
			{status === PAYROLL_PERIOD_STATUS.APPROVED && canPostDisbursement && (
				<PermissionGate permissions={["payroll-periods:transition"]}>
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
									<HandCoinsIcon />
								</span>
								<div className="space-y-1">
									<p className="text-muted-foreground text-sm">
										Total Payables:
										<span className="font-semibold  text-primary">
											{currencyFormatter(totalNetPay)}
										</span>
									</p>
									<p className="text-xs text-muted-foreground">
										The total payables is the sum of all net pay for all employees in the payroll
										period.
									</p>
								</div>
							</div>
						</div>
						<Button
							variant="default"
							onClick={() =>
								setOpen(
									<CustomModal
										title="Salary Disbursement Confirmation"
										subtitle={`Confirm salary disbursement for ${periodName}`}
									>
										<SalaryPeriodDisbursementForm onClose={setClose} periodId={periodId} />
									</CustomModal>
								)
							}
						>
							<CreditCardIcon />
							Confirm Disbursement
						</Button>
					</div>
				</PermissionGate>
			)}
			{(status === PAYROLL_PERIOD_STATUS.PAID || status === PAYROLL_PERIOD_STATUS.CLOSED) && (
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-toast-success-foreground text-toast-success">
							<CheckCheckIcon className="size-4" />
						</span>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">
								<span className="font-semibold  text-success-foreground">
									{currencyFormatter(totalNetPay)} &nbsp;
								</span>
								Disbursed on {dateFormat(new Date(payDate), "long")} to {employeeCount}
								{employeeCount > 1 ? " employees" : " employee"}.
							</p>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}

function SalaryPeriodDisbursementForm({
	periodId,
	onClose,
}: {
	periodId: string;
	onClose: () => void;
}) {
	const { data: activeAccounts } = useQuery(accountQueries.list({}));
	const { isPending: isProcessing, mutate } = useFormUpsert({
		upsertFn: (value: z.infer<typeof salaryDisbursementJournalSchema>) =>
			recordDisbursementAndMarkPaidFn({ data: value }),
		queryKey: ["payroll-periods", "detail", periodId],
		entityName: "Salary Disbursement",
		onSuccessCallback: () => {
			form.reset();
			onClose();
		},
	});
	const bankAccounts = activeAccounts
		?.filter((acc) => acc.type === "asset" && acc.isActive && acc.isPosting)
		.map(({ id, name, code }) => ({ value: id.toString(), label: `${code}-${toTitleCase(name)}` }));
	const form = useAppForm({
		defaultValues: {
			periodId,
		} as z.infer<typeof salaryDisbursementJournalSchema>,
		validators: {
			onSubmit: salaryDisbursementJournalSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value);
		},
	});
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<FieldGroup>
				<form.AppField name="disbursementAccountId">
					{(field) => (
						<field.Select
							label="Bank Account"
							placeholder="Select the bank account to disburse salary from"
						>
							{bankAccounts?.map((account) => (
								<SelectItem key={account.value} value={account.value}>
									{account.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="notes">
					{(field) => (
						<field.Textarea
							className="h-20"
							label="Notes"
							placeholder="Enter notes for the disbursment"
						/>
					)}
				</form.AppField>
			</FieldGroup>
			<FieldGroup>
				<form.AppForm>
					<form.SubmitButton
						isLoading={isProcessing}
						buttonText="Confirm Disbursment"
						onReset={() => {
							form.reset();
							onClose();
						}}
					/>
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}

const REMITTANCE_TYPE_META: Record<
	PayrollRemittanceItemType,
	{ name: string; description: string }
> = {
	paye: { name: "PAYE", description: "Pay As You Earn (KRA)" },
	nssf: { name: "NSSF", description: "National Social Security Fund" },
	shif: { name: "SHIF", description: "Social Health Insurance Fund (SHA)" },
	ahl: { name: "AHL", description: "Affordable Housing Levy (KRA)" },
	nita: { name: "NITA", description: "National Industrial Training Authority" },
	helb: { name: "HELB", description: "Higher Education Loans Board" },
};

type RemittanceFormRow = {
	type: PayrollRemittanceItemType;
	selected: boolean;
	amountRemitted: number | null;
	reference: string | null;
};

type RemittanceFormValues = {
	periodId: string;
	remittanceDate: string;
	remittanceAccountId: string;
	items: RemittanceFormRow[];
};

type StatutoryRemittanceProps = PeriodIdStatus & {};

function StatutoryRemittance({ periodId, status }: StatutoryRemittanceProps) {
	const queryClient = useQueryClient();
	const prePaidState =
		status !== PAYROLL_PERIOD_STATUS.PAID && status !== PAYROLL_PERIOD_STATUS.CLOSED;
	const canSubmit = status === PAYROLL_PERIOD_STATUS.PAID;

	const { data: journalSummary } = useQuery({
		...payrollPeriodQueries.journalSummary({ periodId }),
		enabled: !prePaidState,
	});
	const { data: accountsList } = useQuery(accountQueries.list({}));

	const assetAccounts =
		accountsList
			?.filter((acc) => acc.type === "asset" && acc.isActive && acc.isPosting)
			.map(({ id, name, code }) => ({
				value: id.toString(),
				label: `${code} — ${toTitleCase(name)}`,
			})) ?? [];

	const [formError, setFormError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues: {
			periodId,
			remittanceDate: new Date().toISOString().slice(0, 10),
			remittanceAccountId: "",
			items: PAYROLL_REMITTANCE_ITEM_TYPES.map((type) => ({
				type,
				selected: false as boolean,
				amountRemitted: null as number | null,
				reference: null as string | null,
			})),
		} satisfies RemittanceFormValues,
		onSubmit: ({ value }) => {
			setFormError(null);
			const remittedItems = value.items
				.filter((row) => row.selected && row.amountRemitted != null && row.amountRemitted > 0)
				.map((row) => ({
					type: row.type,
					amountRemitted: row.amountRemitted!,
					reference: row.reference ?? undefined,
				}));

			if (remittedItems.length === 0) {
				setFormError("Select at least one item with a valid amount to remit.");
				return;
			}

			remittanceMutation.mutate({
				periodId,
				remittanceDate: value.remittanceDate || undefined,
				remittanceAccountId: parseInt(value.remittanceAccountId, 10),
				remittedItems,
			});
		},
	});

	const remittanceMutation = useMutation({
		mutationFn: async (payload: Parameters<typeof postStatutoryRemittanceJournalFn>[0]["data"]) => {
			const result = await postStatutoryRemittanceJournalFn({ data: payload });
			if (!result.success) throw new Error(result.error.message);
			return result.data;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: ["payroll-periods", "journal-summary", periodId],
			});
			form.reset();
			setFormError(null);
			const typeLabels = data.itemsPosted.map((i) => i.type.toUpperCase()).join(", ");
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Remittance Recorded"
					message={`Recorded remittance for ${typeLabels} — ${currencyFormatter(data.amountPosted)} total`}
				/>
			));
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : "Failed to record remittance";
			setFormError(message);
			toast.error((t) => <ToastContent t={t} title="Error" message={message} />);
		},
	});

	const [formItems] = useStore(form.store, (state) => [state.values.items]);
	const [remittanceAccountId] = useStore(form.store, (state) => [state.values.remittanceAccountId]);

	const completionItems = journalSummary?.remittanceCompletionStatus.items ?? [];
	const eligibleItems = completionItems.filter((item) => item.requiredAmount > 0);
	const completedCount = eligibleItems.filter((item) => item.isComplete).length;
	const checkedCount = formItems.filter((i) => i.selected).length;
	const canSubmitForm = canSubmit && checkedCount > 0 && !!remittanceAccountId;

	return (
		<section
			className={cn("border rounded-md", {
				"cursor-not-allowed opacity-70 border-dashed": prePaidState,
				"bg-toast-success border-toast-success-border": journalSummary?.allJournalsComplete,
			})}
		>
			{prePaidState ? (
				<div className="p-5">
					<p className="text-sm text-muted-foreground block text-center">
						Statutory remittances unlocks once this period is paid.
					</p>
				</div>
			) : (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="p-5 space-y-5"
				>
					{/* Section header */}
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
						<div className="flex items-center gap-2 flex-1">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-toast-error text-toast-error-foreground">
								<PercentBadgeIcon className="size-4" />
							</span>
							<div>
								<h4 className="text-sm md:text-base font-semibold">Statutory Remittance</h4>
								<p className="text-muted-foreground text-xs">
									{completedCount} of {eligibleItems.length} statutory items remitted
								</p>
							</div>
						</div>
						<Progress
							value={
								eligibleItems.length > 0
									? Math.ceil((completedCount / eligibleItems.length) * 100)
									: 0
							}
							className="max-w-sm"
						/>
					</div>

					{/* Checklist */}
					<div className="divide-y rounded-md border bg-background">
						{formItems.map((row, index) => {
							const { type } = row;
							const meta = REMITTANCE_TYPE_META[type];
							const completionItem = completionItems.find((i) => i.type === type);
							const nothingDue = !completionItem || completionItem.requiredAmount === 0;
							const isComplete = completionItem?.isComplete ?? nothingDue;
							const remittedJournal =
								isComplete && !nothingDue
									? (journalSummary?.remittanceJournals ?? []).find((j) =>
											j.itemsRemitted.some((ir) => ir.type === type)
										)
									: null;

							return (
								<div
									key={type}
									className="flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-3"
								>
									{/* Left: indicator or checkbox + label */}
									<div className="flex items-start gap-3 flex-1 min-w-0">
										{isComplete ? (
											<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success-foreground">
												<CheckIcon className="size-3" />
											</span>
										) : (
											<form.AppField name={`items[${index}].selected`}>
												{(field) => (
													<Checkbox
														id={`remit-${type}`}
														className="mt-0.5"
														checked={field.state.value as boolean}
														disabled={!canSubmit || remittanceMutation.isPending}
														onCheckedChange={(checked) => {
															field.handleChange(checked === true);
															if (checked === true) {
																form.setFieldValue(
																	`items[${index}].amountRemitted`,
																	completionItem?.outstandingAmount ?? 0
																);
															}
														}}
													/>
												)}
											</form.AppField>
										)}
										<div className="min-w-0">
											<label
												htmlFor={isComplete ? undefined : `remit-${type}`}
												className="text-sm font-medium cursor-pointer"
											>
												{meta.name}
												<span className="text-muted-foreground font-normal ml-1">
													— {meta.description}
												</span>
											</label>
											{isComplete && !nothingDue && remittedJournal ? (
												<p className="text-xs text-muted-foreground mt-0.5">
													Remitted on {dateFormat(new Date(remittedJournal.postedAt), "long")}
												</p>
											) : null}
											{!isComplete && completionItem ? (
												<p className="text-xs text-muted-foreground mt-0.5">
													{currencyFormatter(completionItem.outstandingAmount)} outstanding
												</p>
											) : null}
										</div>
									</div>

									{/* Right: badge or inputs */}
									<div className="flex items-start gap-2 sm:ml-auto shrink-0">
										{nothingDue ? (
											<Badge variant="outline">Nothing due</Badge>
										) : isComplete ? (
											<Badge variant="success">Paid</Badge>
										) : (
											<div className="flex flex-col sm:flex-row gap-2">
												<form.AppField name={`items[${index}].amountRemitted`}>
													{(field) => (
														<field.Input
															type="number"
															label=""
															placeholder="Amount"
															className="w-32"
															step="0.01"
															min="0.01"
															max={completionItem?.outstandingAmount}
															disabled={!row.selected || !canSubmit || remittanceMutation.isPending}
														/>
													)}
												</form.AppField>
												<form.AppField name={`items[${index}].reference`}>
													{(field) => (
														<field.Input
															type="text"
															label=""
															placeholder="Ref # (optional)"
															className="w-36"
															disabled={!row.selected || !canSubmit || remittanceMutation.isPending}
														/>
													)}
												</form.AppField>
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>

					{canSubmit && !journalSummary?.allJournalsComplete ? (
						<div className="border-t pt-5 space-y-4">
							<FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<form.AppField name="remittanceDate">
									{(field) => <field.Input type="date" label="Remittance Date" />}
								</form.AppField>
								<form.AppField name="remittanceAccountId">
									{(field) => (
										<field.Select label="Remittance Account" placeholder="Select asset account">
											{assetAccounts.map((acc) => (
												<SelectItem key={acc.value} value={acc.value}>
													{acc.label}
												</SelectItem>
											))}
										</field.Select>
									)}
								</form.AppField>
							</FieldGroup>

							{formError ? (
								<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
									{formError}
								</div>
							) : null}

							<Button type="submit" disabled={!canSubmitForm || remittanceMutation.isPending}>
								<LoadingSwap isLoading={remittanceMutation.isPending}>
									<CheckCheckIcon />
									Record Remittance
								</LoadingSwap>
							</Button>
						</div>
					) : null}
				</form>
			)}
		</section>
	);
}
