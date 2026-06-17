import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatPayrollPeriod } from "@/features/payroll/lib/overtime-options";
import {
	approveOvertimeRecordFn,
	deleteOvertimeRecordFn,
	revokeOvertimeApprovalFn,
	type OvertimeRecordDetailResponse,
	updateOvertimeRecordFn,
} from "@/features/payroll/services/overtime.api";
import { overtimeRecordUpdateFormSchema } from "@/features/payroll/services/overtime.schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";
import toast from "react-hot-toast";

const statusVariant = {
	draft: "warning",
	approved: "success",
	paid: "secondary",
} as const;
const currentPeriodSearch = {
	periodMonth: new Date().getUTCMonth() + 1,
	periodYear: new Date().getUTCFullYear(),
	q: "",
	status: undefined,
	departmentId: undefined,
} as const;

type EditableOvertimeValues = {
	id: string;
	weekdayOvertimeHours: number;
	weekendOvertimeHours: number;
	publicHolidayOvertimeHours: number;
	notes: string | null;
};

export function OvertimeRecordDetail({ record }: { record: OvertimeRecordDetailResponse }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const canEdit = record.status === "draft";

	const updateMutation = useFormUpsert({
		upsertFn: (data: EditableOvertimeValues) =>
			updateOvertimeRecordFn({
				data: {
					recordId: record.id,
					payload: data,
				},
			}),
		entityName: "Overtime record",
		queryKey: ["overtime-records"],
		successMessage: {
			update: "Overtime record updated successfully.",
		},
		onSuccessCallback: (result) => {
			if (result.warnings.length > 0) {
				toast.error(result.warnings.join(" "));
			}
		},
	});

	const form = useAppForm({
		defaultValues: {
			id: record.id,
			weekdayOvertimeHours: record.weekdayOvertimeHours,
			weekendOvertimeHours: record.weekendOvertimeHours,
			publicHolidayOvertimeHours: record.publicHolidayOvertimeHours,
			notes: record.notes,
		} satisfies EditableOvertimeValues,
		validators: {
			onSubmit: overtimeRecordUpdateFormSchema,
		},
		onSubmit: ({ value }) => {
			updateMutation.mutate(value);
		},
	});

	const approveMutation = useMutation({
		mutationFn: async () => {
			const result = await approveOvertimeRecordFn({
				data: { recordId: record.id },
			});

			if (!result.success) {
				throw new Error(result.error.message);
			}

			return result.data;
		},
		onSuccess: async (result) => {
			if (result.warnings.length > 0) {
				toast.error(result.warnings.join(" "));
			} else {
				toast.success("Overtime record approved successfully.");
			}
			await queryClient.invalidateQueries({ queryKey: ["overtime-records"] });
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to approve overtime record.");
		},
	});

	const revokeMutation = useMutation({
		mutationFn: async () => {
			const result = await revokeOvertimeApprovalFn({
				data: { recordId: record.id },
			});

			if (!result.success) {
				throw new Error(result.error.message);
			}

			return result.data;
		},
		onSuccess: async () => {
			toast.success("Overtime approval revoked successfully.");
			await queryClient.invalidateQueries({ queryKey: ["overtime-records"] });
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to revoke overtime approval.");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async () => {
			const result = await deleteOvertimeRecordFn({
				data: record.id,
			});

			if (!result.success) {
				throw new Error(result.error.message);
			}
		},
		onSuccess: async () => {
			toast.success("Overtime record deleted successfully.");
			await queryClient.invalidateQueries({ queryKey: ["overtime-records"] });
			navigate({
				to: "/app/payroll/overtime",
				search: currentPeriodSearch,
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to delete overtime record.");
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	usePreventUnsavedChanges(canEdit && isDirty);

	const totalHours =
		record.weekdayOvertimeHours + record.weekendOvertimeHours + record.publicHolidayOvertimeHours;

	return (
		<div className="space-y-6">
			<div className="rounded-md border bg-card p-6">
				<PageHeader
					title="Overtime Record"
					description={`${toTitleCase(record.fullName)} (E${record.employeeNo}) • ${formatPayrollPeriod(record.periodMonth, record.periodYear)}`}
				/>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<Badge variant={statusVariant[record.status]}>{toTitleCase(record.status)}</Badge>
					<Badge variant="outline">{record.departmentName ?? "No Department"}</Badge>
					<Badge variant="outline">Total Hours: {totalHours.toFixed(2)}</Badge>
					{record.payrollSlipId ? <Badge variant="secondary">Payroll Slip Linked</Badge> : null}
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
				<div className="rounded-md border bg-card p-6 space-y-4">
					<h2 className="text-lg font-semibold">Pay Breakdown</h2>
					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">
								Overtime Hourly Rate
							</p>
							<p className="mt-1 text-sm font-medium">
								{currencyFormatter(record.overtimeHourlyRate)}
							</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">
								Total Overtime Pay
							</p>
							<p className="mt-1 text-sm font-medium">
								{currencyFormatter(record.totalOvertimePay)}
							</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">Weekday Pay</p>
							<p className="mt-1 text-sm font-medium">
								{currencyFormatter(record.weekdayOvertimePay)}
							</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">Weekend Pay</p>
							<p className="mt-1 text-sm font-medium">
								{currencyFormatter(record.weekendOvertimePay)}
							</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">
								Public Holiday Pay
							</p>
							<p className="mt-1 text-sm font-medium">
								{currencyFormatter(record.publicHolidayOvertimePay)}
							</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">Approved At</p>
							<p className="mt-1 text-sm font-medium">
								{record.approvedAt ? dateFormat(record.approvedAt, "long") : "-"}
							</p>
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">Created By</p>
							<p className="mt-1 text-sm font-medium capitalize">
								{record.createdByName ?? record.createdBy ?? "-"}
							</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">Approved By</p>
							<p className="mt-1 text-sm font-medium capitalize">
								{record.approvedByName ?? record.approvedBy ?? "-"}
							</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">Payroll Slip</p>
							<p className="mt-1 text-sm font-medium">{record.payrollSlipId ?? "-"}</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</p>
							<p className="mt-1 text-sm font-medium">{dateFormat(record.updatedAt, "long")}</p>
						</div>
					</div>
				</div>

				<div className="space-y-6">
					<div className="rounded-md border bg-card p-6 space-y-4">
						<h2 className="text-lg font-semibold">Recorded Hours</h2>
						<form
							className="space-y-4"
							onSubmit={(event) => {
								event.preventDefault();
								event.stopPropagation();
								form.handleSubmit();
							}}
						>
							<form.AppField name="weekdayOvertimeHours">
								{(field) => (
									<field.Input
										label="Weekday Hours"
										type="number"
										min={0}
										step="0.01"
										required
										disabled={!canEdit}
									/>
								)}
							</form.AppField>
							<form.AppField name="weekendOvertimeHours">
								{(field) => (
									<field.Input
										label="Weekend Hours"
										type="number"
										min={0}
										step="0.01"
										required
										disabled={!canEdit}
									/>
								)}
							</form.AppField>
							<form.AppField name="publicHolidayOvertimeHours">
								{(field) => (
									<field.Input
										label="Public Holiday Hours"
										type="number"
										min={0}
										step="0.01"
										required
										disabled={!canEdit}
									/>
								)}
							</form.AppField>
							<form.AppField name="notes">
								{(field) => (
									<field.Textarea
										label="Notes"
										rows={4}
										disabled={!canEdit}
										placeholder="Add supporting notes for this overtime entry"
									/>
								)}
							</form.AppField>
							{canEdit ? (
								<form.AppForm>
									<form.SubmitButton
										buttonText="Save Draft Changes"
										isLoading={updateMutation.isPending}
									/>
								</form.AppForm>
							) : (
								<p className="text-sm text-muted-foreground">
									This record is locked because it is no longer in draft status.
								</p>
							)}
						</form>
					</div>

					<div className="rounded-md border bg-card p-6 space-y-4">
						<h2 className="text-lg font-semibold">Workflow Actions</h2>
						<div className="flex flex-wrap gap-3">
							{record.status === "draft" ? (
								<>
									<Button
										onClick={() => approveMutation.mutate()}
										disabled={approveMutation.isPending}
									>
										Approve Record
									</Button>
									<Button
										variant="destructive"
										onClick={() => deleteMutation.mutate()}
										disabled={deleteMutation.isPending}
									>
										Delete Draft
									</Button>
								</>
							) : null}
							{record.status === "approved" && !record.payrollSlipId ? (
								<Button
									variant="outline"
									onClick={() => revokeMutation.mutate()}
									disabled={revokeMutation.isPending}
								>
									Revoke Approval
								</Button>
							) : null}
						</div>
						{record.status === "paid" ? (
							<p className="text-sm text-muted-foreground">
								This record has been linked to payroll and is now immutable.
							</p>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
