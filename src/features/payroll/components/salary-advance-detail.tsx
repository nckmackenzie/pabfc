import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/ui/permission-gate";
import { SelectItem } from "@/components/ui/select";
import { formatPayrollPeriod } from "@/features/payroll/lib/overtime-options";
import { SALARY_ADVANCE_STATUS_VARIANTS } from "@/features/payroll/lib/salary-advance-options";
import { salaryAdvanceQueries } from "@/features/payroll/services/queries";
import {
	approveSalaryAdvanceFn,
	cancelSalaryAdvanceFn,
	rejectSalaryAdvanceFn,
	type SalaryAdvanceDetailResponse,
	type SalaryAdvanceFormOptionsResponse,
} from "@/features/payroll/services/salary-advances.api";
import {
	salaryAdvanceApproveFormSchema,
	salaryAdvanceCancelFormSchema,
	salaryAdvanceRejectFormSchema,
} from "@/features/payroll/services/salary-advance.schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

function getSalaryAdvanceStatusVariant(status: string) {
	return SALARY_ADVANCE_STATUS_VARIANTS[status as keyof typeof SALARY_ADVANCE_STATUS_VARIANTS];
}

function SalaryAdvanceStatusBadge({ status }: { status: SalaryAdvanceDetailResponse["status"] }) {
	return (
		<Badge className="capitalize" variant={getSalaryAdvanceStatusVariant(status)}>
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

export function SalaryAdvanceDetail({
	formOptions,
	initialAdvance,
}: {
	formOptions: SalaryAdvanceFormOptionsResponse;
	initialAdvance: SalaryAdvanceDetailResponse;
}) {
	const { data: advance } = useSuspenseQuery(
		salaryAdvanceQueries.detail({ advanceId: initialAdvance.id })
	);
	const { data: statement } = useSuspenseQuery(
		salaryAdvanceQueries.statement({ advanceId: initialAdvance.id })
	);
	const currentDate = new Date();

	const approveMutation = useFormUpsert({
		upsertFn: (value: {
			id?: string;
			approvedAmount: number;
			approvedRecoveryMonths: number;
			disbursementAccountId: string;
			recoveryStartMonth: number;
			recoveryStartYear: number;
			notes: string | null;
		}) =>
			approveSalaryAdvanceFn({
				data: {
					advanceId: advance.id,
					payload: {
						...value,
						disbursementAccountId: Number(value.disbursementAccountId),
					},
				},
			}),
		entityName: "Salary advance",
		queryKey: ["salary-advances"],
		successMessage: {
			update: "Salary advance approved and disbursed successfully.",
		},
	});

	const rejectMutation = useFormUpsert({
		upsertFn: (value: { id?: string; advanceId: string; rejectionReason: string }) =>
			rejectSalaryAdvanceFn({
				data: {
					advanceId: advance.id,
					rejectionReason: value.rejectionReason,
				},
			}),
		entityName: "Salary advance rejection",
		queryKey: ["salary-advances"],
		successMessage: {
			update: "Salary advance rejected successfully.",
		},
	});

	const cancelMutation = useFormUpsert({
		upsertFn: (value: { id?: string; advanceId: string; cancellationReason: string }) =>
			cancelSalaryAdvanceFn({
				data: {
					advanceId: advance.id,
					cancellationReason: value.cancellationReason,
				},
			}),
		entityName: "Salary advance cancellation",
		queryKey: ["salary-advances"],
		successMessage: {
			update: "Salary advance cancelled successfully.",
		},
	});

	const approveForm = useAppForm({
		defaultValues: {
			id: advance.id,
			approvedAmount: advance.approvedAmount ?? advance.requestedAmount,
			approvedRecoveryMonths: advance.approvedRecoveryMonths ?? advance.requestedRecoveryMonths,
			disbursementAccountId: advance.disbursementAccountId
				? String(advance.disbursementAccountId)
				: "",
			recoveryStartMonth: advance.recoveryStartMonth ?? currentDate.getUTCMonth() + 1,
			recoveryStartYear: advance.recoveryStartYear ?? currentDate.getUTCFullYear(),
			notes: advance.notes,
		},
		validators: {
			onSubmit: salaryAdvanceApproveFormSchema,
		},
		onSubmit: ({ value }) => approveMutation.mutate(value),
	});

	const rejectForm = useAppForm({
		defaultValues: {
			id: advance.id,
			advanceId: advance.id,
			rejectionReason: advance.rejectionReason ?? "",
		},
		validators: {
			onSubmit: salaryAdvanceRejectFormSchema,
		},
		onSubmit: ({ value }) => rejectMutation.mutate(value),
	});

	const cancelForm = useAppForm({
		defaultValues: {
			id: advance.id,
			advanceId: advance.id,
			cancellationReason: advance.cancellationReason ?? "",
		},
		validators: {
			onSubmit: salaryAdvanceCancelFormSchema,
		},
		onSubmit: ({ value }) => cancelMutation.mutate(value),
	});

	return (
		<div className="space-y-6">
			<div className="rounded-md border bg-card p-6">
				<PageHeader
					title="Salary Advance"
					description={`${advance.fullName} (E${advance.employeeNo})`}
				/>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<SalaryAdvanceStatusBadge status={advance.status} />
					<Badge variant="outline">Applied {advance.applicationDate}</Badge>
					{advance.recoveryStartMonth && advance.recoveryStartYear ? (
						<Badge variant="outline">
							Starts {formatPayrollPeriod(advance.recoveryStartMonth, advance.recoveryStartYear)}
						</Badge>
					) : null}
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<SummaryCard label="Requested Amount" value={currencyFormatter(advance.requestedAmount)} />
				<SummaryCard
					label="Approved Amount"
					value={currencyFormatter(advance.approvedAmount ?? 0)}
				/>
				<SummaryCard
					label="Outstanding Balance"
					value={currencyFormatter(advance.outstandingBalance ?? 0)}
				/>
				<SummaryCard
					label="Monthly Recovery"
					value={currencyFormatter(advance.monthlyRecoveryAmount ?? 0)}
				/>
				<SummaryCard label="Total Recovered" value={currencyFormatter(advance.totalRecovered)} />
				<SummaryCard label="Recoveries Processed" value={advance.recoveriesProcessed} />
				<SummaryCard label="Recoveries Remaining" value={advance.remainingRecoveries} />
				<SummaryCard label="Department" value={advance.departmentName ?? "-"} />
			</div>

			<div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
				<div className="space-y-6">
					<div className="rounded-md border bg-card p-6 space-y-4">
						<h2 className="text-lg font-semibold">Advance Details</h2>
						<div className="grid gap-3 md:grid-cols-2">
							<SummaryCard label="Reason" value={advance.reason ?? "-"} />
							<SummaryCard label="Job Title" value={advance.jobTitle ?? "-"} />
							<SummaryCard
								label="Approved By"
								value={advance.approvedByName ? toTitleCase(advance.approvedByName) : "-"}
							/>
							<SummaryCard
								label="Approved At"
								value={advance.approvedAt ? dateFormat(advance.approvedAt, "long") : "-"}
							/>
							<SummaryCard
								label="Rejected By"
								value={advance.rejectedByName ? toTitleCase(advance.rejectedByName) : "-"}
							/>
							<SummaryCard label="Cancelled By" value={advance.cancelledByName ?? "-"} />
							<SummaryCard label="Disbursed Date" value={advance.disbursementDate ?? "-"} />
						</div>
						<SummaryCard label="Notes" value={advance.notes ?? "-"} />
					</div>

					<div className="rounded-md border bg-card p-6 space-y-4">
						<h2 className="text-lg font-semibold">Recovery Statement</h2>
						<div className="grid gap-3 md:grid-cols-3">
							<SummaryCard
								label="Opening Balance"
								value={currencyFormatter(statement.openingBalance)}
							/>
							<SummaryCard
								label="Closing Outstanding"
								value={currencyFormatter(statement.closingOutstandingBalance)}
							/>
							<SummaryCard label="Recoveries Recorded" value={statement.entries.length} />
						</div>

						{statement.entries.length ? (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-left">
											<th className="pb-2 pr-4">Date</th>
											<th className="pb-2 pr-4">Amount</th>
											<th className="pb-2 pr-4">Balance Before</th>
											<th className="pb-2 pr-4">Balance After</th>
											<th className="pb-2">Final</th>
										</tr>
									</thead>
									<tbody>
										{statement.entries.map((entry) => (
											<tr
												key={`${entry.date}-${entry.balanceAfter}`}
												className="border-b last:border-b-0"
											>
												<td className="py-2 pr-4">{entry.date}</td>
												<td className="py-2 pr-4">{currencyFormatter(entry.amount)}</td>
												<td className="py-2 pr-4">{currencyFormatter(entry.balanceBefore)}</td>
												<td className="py-2 pr-4">{currencyFormatter(entry.balanceAfter)}</td>
												<td className="py-2">{entry.isLastRecovery ? "Yes" : "No"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No recoveries have been recorded for this salary advance yet.
							</p>
						)}
					</div>
				</div>

				<div className="space-y-6">
					{advance.status === "pending" ? (
						<>
							<PermissionGate permission="salary-advances:approve">
								<div className="rounded-md border bg-card p-6 space-y-4">
									<h2 className="text-lg font-semibold">Approve And Disburse</h2>
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
										<approveForm.AppField name="approvedRecoveryMonths">
											{(field) => (
												<field.Input
													label="Approved Recovery Months"
													type="number"
													min={1}
													max={3}
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
															{`${account.code ?? "No Code"} - ${account.name}`}
														</SelectItem>
													))}
												</field.Select>
											)}
										</approveForm.AppField>
										<div className="grid gap-4 md:grid-cols-2">
											<approveForm.AppField name="recoveryStartMonth">
												{(field) => (
													<field.Input
														label="Recovery Start Month"
														type="number"
														min={1}
														max={12}
														required
													/>
												)}
											</approveForm.AppField>
											<approveForm.AppField name="recoveryStartYear">
												{(field) => (
													<field.Input
														label="Recovery Start Year"
														type="number"
														min={2020}
														max={2100}
														required
													/>
												)}
											</approveForm.AppField>
										</div>
										<approveForm.AppField name="notes">
											{(field) => <field.Textarea label="Approval Notes" rows={3} />}
										</approveForm.AppField>
										<approveForm.AppForm>
											<approveForm.SubmitButton
												buttonText="Approve Salary Advance"
												isLoading={approveMutation.isPending}
											/>
										</approveForm.AppForm>
									</form>
								</div>
							</PermissionGate>

							<PermissionGate permission="salary-advances:approve">
								<div className="rounded-md border bg-card p-6 space-y-4">
									<h2 className="text-lg font-semibold">Reject Advance</h2>
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
												buttonText="Reject Salary Advance"
												isLoading={rejectMutation.isPending}
											/>
										</rejectForm.AppForm>
									</form>
								</div>
							</PermissionGate>

							<PermissionGate permission="salary-advances:approve">
								<div className="rounded-md border bg-card p-6 space-y-4">
									<h2 className="text-lg font-semibold">Cancel Advance</h2>
									<form
										className="space-y-4"
										onSubmit={(event) => {
											event.preventDefault();
											event.stopPropagation();
											cancelForm.handleSubmit();
										}}
									>
										<cancelForm.AppField name="cancellationReason">
											{(field) => <field.Textarea label="Cancellation Reason" rows={4} required />}
										</cancelForm.AppField>
										<cancelForm.AppForm>
											<cancelForm.SubmitButton
												buttonText="Cancel Salary Advance"
												isLoading={cancelMutation.isPending}
											/>
										</cancelForm.AppForm>
									</form>
								</div>
							</PermissionGate>
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}
