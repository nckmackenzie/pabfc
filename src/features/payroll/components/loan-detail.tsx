import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/ui/permission-gate";
import { SelectItem } from "@/components/ui/select";
import { LOAN_STATUS_VARIANTS } from "@/features/payroll/lib/loan-options";
import { formatPayrollPeriod } from "@/features/payroll/lib/overtime-options";
import {
	approveLoanFn,
	type LoanDetailResponse,
	type LoanFormOptionsResponse,
	pauseLoanRepaymentsFn,
	rejectLoanFn,
	resumeLoanRepaymentsFn,
	settleEarlyFn,
} from "@/features/payroll/services/loans.api";
import {
	loanApproveFormSchema,
	loanPauseFormSchema,
	loanRejectFormSchema,
	loanResumeFormSchema,
	loanSettlementFormSchema,
} from "@/features/payroll/services/loan.schemas";
import { loanQueries } from "@/features/payroll/services/queries";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { useAppForm } from "@/lib/form";

function getLoanStatusVariant(status: string) {
	return LOAN_STATUS_VARIANTS[status as keyof typeof LOAN_STATUS_VARIANTS];
}

function LoanStatusBadge({ status }: { status: LoanDetailResponse["status"] }) {
	return (
		<Badge className="capitalize" variant={getLoanStatusVariant(status)}>
			{status.replaceAll("_", " ")}
		</Badge>
	);
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="rounded-md border bg-muted/30 p-3">
			<p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
			<p className="mt-1 text-sm font-medium">{value}</p>
		</div>
	);
}

export function LoanDetail({
	initialLoan,
	formOptions,
}: {
	initialLoan: LoanDetailResponse;
	formOptions: LoanFormOptionsResponse;
}) {
	const { data: loan } = useSuspenseQuery(loanQueries.detail({ loanId: initialLoan.id }));
	const currentDate = new Date();

	const approveMutation = useFormUpsert({
		upsertFn: (value: {
			id?: string;
			approvedAmount: number;
			approvedInstalments: number;
			disbursementAccountId: string;
			repaymentStartMonth: number;
			repaymentStartYear: number;
			notes: string | null;
		}) =>
			approveLoanFn({
				data: {
					loanId: loan.id,
					payload: {
						...value,
						disbursementAccountId: Number(value.disbursementAccountId),
					},
				},
			}),
		entityName: "Employee loan",
		queryKey: ["employee-loans"],
		successMessage: {
			update: "Loan approved successfully.",
		},
	});

	const rejectMutation = useFormUpsert({
		upsertFn: (value: { id?: string; loanId: string; rejectionReason: string }) =>
			rejectLoanFn({
				data: {
					loanId: loan.id,
					rejectionReason: value.rejectionReason,
				},
			}),
		entityName: "Employee loan rejection",
		queryKey: ["employee-loans"],
		successMessage: {
			update: "Loan rejected successfully.",
		},
	});

	const pauseMutation = useFormUpsert({
		upsertFn: (value: { id?: string; loanId: string; notes: string | null }) =>
			pauseLoanRepaymentsFn({
				data: {
					loanId: loan.id,
					notes: value.notes,
				},
			}),
		entityName: "Employee loan",
		queryKey: ["employee-loans"],
		successMessage: {
			update: "Loan repayments paused successfully.",
		},
	});

	const resumeMutation = useFormUpsert({
		upsertFn: (value: {
			id?: string;
			loanId: string;
			repaymentStartMonth: number;
			repaymentStartYear: number;
			notes: string | null;
		}) =>
			resumeLoanRepaymentsFn({
				data: {
					loanId: loan.id,
					repaymentStartMonth: value.repaymentStartMonth,
					repaymentStartYear: value.repaymentStartYear,
					notes: value.notes,
				},
			}),
		entityName: "Employee loan",
		queryKey: ["employee-loans"],
		successMessage: {
			update: "Loan repayments resumed successfully.",
		},
	});

	const settlementMutation = useFormUpsert({
		upsertFn: (value: {
			id?: string;
			loanId: string;
			settlementAmount: number;
			disbursementAccountId: string;
			notes: string | null;
		}) =>
			settleEarlyFn({
				data: {
					loanId: loan.id,
					settlementAmount: value.settlementAmount,
					disbursementAccountId: Number(value.disbursementAccountId),
					notes: value.notes,
				},
			}),
		entityName: "Employee loan settlement",
		queryKey: ["employee-loans"],
		successMessage: {
			update: "Loan settled successfully.",
		},
	});

	const approveForm = useAppForm({
		defaultValues: {
			id: loan.id,
			approvedAmount: loan.approvedAmount ?? loan.principalAmount,
			approvedInstalments: loan.approvedInstalments ?? loan.requestedInstalments,
			disbursementAccountId: loan.disbursementAccountId ? String(loan.disbursementAccountId) : "",
			repaymentStartMonth: loan.repaymentStartMonth ?? currentDate.getUTCMonth() + 1,
			repaymentStartYear: loan.repaymentStartYear ?? currentDate.getUTCFullYear(),
			notes: loan.notes,
		},
		validators: {
			onSubmit: loanApproveFormSchema,
		},
		onSubmit: ({ value }) => approveMutation.mutate(value),
	});

	const rejectForm = useAppForm({
		defaultValues: {
			id: loan.id,
			loanId: loan.id,
			rejectionReason: loan.rejectionReason ?? "",
		},
		validators: {
			onSubmit: loanRejectFormSchema,
		},
		onSubmit: ({ value }) => rejectMutation.mutate(value),
	});

	const pauseForm = useAppForm({
		defaultValues: {
			id: loan.id,
			loanId: loan.id,
			notes: loan.notes,
		},
		validators: {
			onSubmit: loanPauseFormSchema,
		},
		onSubmit: ({ value }) => pauseMutation.mutate(value),
	});

	const resumeForm = useAppForm({
		defaultValues: {
			id: loan.id,
			loanId: loan.id,
			repaymentStartMonth: currentDate.getUTCMonth() + 1,
			repaymentStartYear: currentDate.getUTCFullYear(),
			notes: loan.notes,
		},
		validators: {
			onSubmit: loanResumeFormSchema,
		},
		onSubmit: ({ value }) => resumeMutation.mutate(value),
	});

	const settlementForm = useAppForm({
		defaultValues: {
			id: loan.id,
			loanId: loan.id,
			settlementAmount: loan.outstandingBalance ?? 0,
			disbursementAccountId: "",
			notes: loan.notes,
		},
		validators: {
			onSubmit: loanSettlementFormSchema,
		},
		onSubmit: ({ value }) => settlementMutation.mutate(value),
	});

	return (
		<div className="space-y-6">
			<div className="rounded-md border bg-card p-6">
				<PageHeader title="Employee Loan" description={`${loan.fullName} (E${loan.employeeNo})`} />
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<LoanStatusBadge status={loan.status} />
					<Badge variant="outline">Applied {loan.applicationDate}</Badge>
					{loan.repaymentStartMonth && loan.repaymentStartYear ? (
						<Badge variant="outline">
							Starts {formatPayrollPeriod(loan.repaymentStartMonth, loan.repaymentStartYear)}
						</Badge>
					) : null}
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<SummaryCard label="Requested Amount" value={currencyFormatter(loan.principalAmount)} />
				<SummaryCard
					label="Approved Amount"
					value={currencyFormatter(loan.approvedAmount ?? loan.principalAmount)}
				/>
				<SummaryCard
					label="Outstanding Balance"
					value={currencyFormatter(loan.outstandingBalance ?? 0)}
				/>
				<SummaryCard
					label="Monthly Instalment"
					value={currencyFormatter(loan.monthlyInstalment ?? 0)}
				/>
				<SummaryCard label="Total Paid" value={currencyFormatter(loan.totalPaid)} />
				<SummaryCard
					label="Interest Rate"
					value={`${(loan.annualInterestRate * 100).toFixed(2)}%`}
				/>
				<SummaryCard label="Instalments Paid" value={loan.instalmentsPaid} />
				<SummaryCard label="Remaining Instalments" value={loan.remainingInstalments} />
			</div>

			<div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
				<div className="space-y-6">
					<div className="rounded-md border bg-card p-6 space-y-4">
						<h2 className="text-lg font-semibold">Loan Terms</h2>
						<div className="grid gap-3 md:grid-cols-2">
							<SummaryCard label="Purpose" value={loan.purpose ?? "-"} />
							<SummaryCard label="Job Title" value={loan.jobTitle ?? "-"} />
							<SummaryCard label="Approved By" value={loan.approvedByName ?? "-"} />
							<SummaryCard
								label="Approved At"
								value={loan.approvedAt ? dateFormat(loan.approvedAt, "long") : "-"}
							/>
							<SummaryCard label="Paused By" value={loan.pausedByName ?? "-"} />
							<SummaryCard label="Rejected By" value={loan.rejectedByName ?? "-"} />
						</div>
						<SummaryCard label="Notes" value={loan.notes ?? "-"} />
					</div>

					<div className="rounded-md border bg-card p-6 space-y-4">
						<h2 className="text-lg font-semibold">Repayment Schedule</h2>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b text-left">
										<th className="pb-2 pr-4">Instalment</th>
										<th className="pb-2 pr-4">Principal</th>
										<th className="pb-2 pr-4">Interest</th>
										<th className="pb-2 pr-4">Total</th>
										<th className="pb-2">Balance After</th>
									</tr>
								</thead>
								<tbody>
									{loan.schedule.schedule.map((item) => (
										<tr key={item.instalmentNumber} className="border-b last:border-b-0">
											<td className="py-2 pr-4">{item.instalmentNumber}</td>
											<td className="py-2 pr-4">{currencyFormatter(item.principalComponent)}</td>
											<td className="py-2 pr-4">{currencyFormatter(item.interestComponent)}</td>
											<td className="py-2 pr-4">{currencyFormatter(item.totalPayment)}</td>
											<td className="py-2">{currencyFormatter(item.balanceAfter)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					<div className="rounded-md border bg-card p-6 space-y-4">
						<h2 className="text-lg font-semibold">Repayment History</h2>
						{loan.repayments.length ? (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-left">
											<th className="pb-2 pr-4">Date</th>
											<th className="pb-2 pr-4">Principal</th>
											<th className="pb-2 pr-4">Interest</th>
											<th className="pb-2 pr-4">Total</th>
											<th className="pb-2">Balance After</th>
										</tr>
									</thead>
									<tbody>
										{loan.repayments.map((repayment) => (
											<tr key={repayment.id} className="border-b last:border-b-0">
												<td className="py-2 pr-4">{repayment.repaymentDate}</td>
												<td className="py-2 pr-4">
													{currencyFormatter(repayment.principalComponent)}
												</td>
												<td className="py-2 pr-4">
													{currencyFormatter(repayment.interestComponent)}
												</td>
												<td className="py-2 pr-4">{currencyFormatter(repayment.totalRepayment)}</td>
												<td className="py-2">{currencyFormatter(repayment.balanceAfter)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No repayments have been recorded for this loan yet.
							</p>
						)}
					</div>
				</div>

				<div className="space-y-6">
					{loan.status === "pending" ? (
						<>
							<PermissionGate permission="employee-loans:approve">
								<div className="rounded-md border bg-card p-6 space-y-4">
									<h2 className="text-lg font-semibold">Approve Loan</h2>
									<form
										className="space-y-4"
										onSubmit={(event) => {
											event.preventDefault();
											event.stopPropagation();
											approveForm.handleSubmit();
										}}
									>
										<approveForm.AppField name="approvedAmount">
											{(field) => (
												<field.Input
													label="Approved Amount"
													type="number"
													min={0}
													step="0.01"
													required
												/>
											)}
										</approveForm.AppField>
										<approveForm.AppField name="approvedInstalments">
											{(field) => (
												<field.Input
													label="Approved Instalments"
													type="number"
													min={1}
													max={60}
													step="1"
													required
												/>
											)}
										</approveForm.AppField>
										<approveForm.AppField name="disbursementAccountId">
											{(field) => (
												<field.Select label="Disbursement Account" required>
													{formOptions.disbursementAccounts.map((account) => (
														<SelectItem key={account.id} value={String(account.id)}>
															{account.name}
														</SelectItem>
													))}
												</field.Select>
											)}
										</approveForm.AppField>
										<div className="grid gap-4 md:grid-cols-2">
											<approveForm.AppField name="repaymentStartMonth">
												{(field) => (
													<field.Input
														label="Repayment Start Month"
														type="number"
														min={1}
														max={12}
													/>
												)}
											</approveForm.AppField>
											<approveForm.AppField name="repaymentStartYear">
												{(field) => (
													<field.Input
														label="Repayment Start Year"
														type="number"
														min={2000}
														max={2100}
													/>
												)}
											</approveForm.AppField>
										</div>
										<approveForm.AppField name="notes">
											{(field) => <field.Textarea label="Approval Notes" rows={3} />}
										</approveForm.AppField>
										<approveForm.AppForm>
											<approveForm.SubmitButton
												buttonText="Approve Loan"
												isLoading={approveMutation.isPending}
											/>
										</approveForm.AppForm>
									</form>
								</div>
							</PermissionGate>

							<PermissionGate permission="employee-loans:reject">
								<div className="rounded-md border bg-card p-6 space-y-4">
									<h2 className="text-lg font-semibold">Reject Loan</h2>
									<form
										className="space-y-4"
										onSubmit={(event) => {
											event.preventDefault();
											event.stopPropagation();
											rejectForm.handleSubmit();
										}}
									>
										<rejectForm.AppField name="rejectionReason">
											{(field) => <field.Textarea label="Rejection Reason" rows={4} required />}
										</rejectForm.AppField>
										<rejectForm.AppForm>
											<rejectForm.SubmitButton
												buttonText="Reject Loan"
												isLoading={rejectMutation.isPending}
											/>
										</rejectForm.AppForm>
									</form>
								</div>
							</PermissionGate>
						</>
					) : null}

					{loan.status === "active" ? (
						<>
							<PermissionGate permission="employee-loans:pause">
								<div className="rounded-md border bg-card p-6 space-y-4">
									<h2 className="text-lg font-semibold">Pause Repayments</h2>
									<form
										className="space-y-4"
										onSubmit={(event) => {
											event.preventDefault();
											event.stopPropagation();
											pauseForm.handleSubmit();
										}}
									>
										<p className="text-sm text-muted-foreground">
											Paused loans are excluded from payroll deduction queries until resumed.
										</p>
										<pauseForm.AppField name="notes">
											{(field) => <field.Textarea label="Pause Notes" rows={3} />}
										</pauseForm.AppField>
										<pauseForm.AppForm>
											<pauseForm.SubmitButton
												buttonText="Pause Loan"
												isLoading={pauseMutation.isPending}
											/>
										</pauseForm.AppForm>
									</form>
								</div>
							</PermissionGate>

							<PermissionGate permission="employee-loans:settle">
								<div className="rounded-md border bg-card p-6 space-y-4">
									<h2 className="text-lg font-semibold">Early Settlement</h2>
									<form
										className="space-y-4"
										onSubmit={(event) => {
											event.preventDefault();
											event.stopPropagation();
											settlementForm.handleSubmit();
										}}
									>
										<settlementForm.AppField name="settlementAmount">
											{(field) => (
												<field.Input
													label="Settlement Amount"
													type="number"
													min={0}
													step="0.01"
													required
												/>
											)}
										</settlementForm.AppField>
										<settlementForm.AppField name="disbursementAccountId">
											{(field) => (
												<field.Select label="Receiving Account" required>
													{formOptions.disbursementAccounts.map((account) => (
														<SelectItem key={account.id} value={String(account.id)}>
															{`${account.code ?? "No Code"} - ${account.name}`}
														</SelectItem>
													))}
												</field.Select>
											)}
										</settlementForm.AppField>
										<settlementForm.AppField name="notes">
											{(field) => <field.Textarea label="Settlement Notes" rows={3} />}
										</settlementForm.AppField>
										<settlementForm.AppForm>
											<settlementForm.SubmitButton
												buttonText="Settle Loan"
												isLoading={settlementMutation.isPending}
											/>
										</settlementForm.AppForm>
									</form>
								</div>
							</PermissionGate>
						</>
					) : null}

					{loan.status === "paused" ? (
						<PermissionGate permission="employee-loans:resume">
							<div className="rounded-md border bg-card p-6 space-y-4">
								<h2 className="text-lg font-semibold">Resume Repayments</h2>
								<form
									className="space-y-4"
									onSubmit={(event) => {
										event.preventDefault();
										event.stopPropagation();
										resumeForm.handleSubmit();
									}}
								>
									<div className="grid gap-4 md:grid-cols-2">
										<resumeForm.AppField name="repaymentStartMonth">
											{(field) => (
												<field.Input label="Repayment Start Month" type="number" min={1} max={12} />
											)}
										</resumeForm.AppField>
										<resumeForm.AppField name="repaymentStartYear">
											{(field) => (
												<field.Input
													label="Repayment Start Year"
													type="number"
													min={2000}
													max={2100}
												/>
											)}
										</resumeForm.AppField>
									</div>
									<resumeForm.AppField name="notes">
										{(field) => <field.Textarea label="Resume Notes" rows={3} />}
									</resumeForm.AppField>
									<resumeForm.AppForm>
										<resumeForm.SubmitButton
											buttonText="Resume Loan"
											isLoading={resumeMutation.isPending}
										/>
									</resumeForm.AppForm>
								</form>
							</div>
						</PermissionGate>
					) : null}
				</div>
			</div>
		</div>
	);
}
