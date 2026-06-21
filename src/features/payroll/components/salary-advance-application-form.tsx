import { useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { SelectItem } from "@/components/ui/select";
import { ToastContent } from "@/components/ui/toast-content";
import { PageHeader } from "@/components/ui/page-header";
import {
	applyForSalaryAdvanceFn,
	type SalaryAdvanceFormOptionsResponse,
} from "@/features/payroll/services/salary-advances.api";
import {
	salaryAdvanceCreateFormSchema,
	type SalaryAdvanceCreateFormInput,
} from "@/features/payroll/services/salary-advance.schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";

const defaultValues: SalaryAdvanceCreateFormInput = {
	id: undefined,
	employeeId: "",
	requestedAmount: 0,
	requestedRecoveryMonths: 1,
	reason: null,
};

export function SalaryAdvanceApplicationForm({
	options,
	preselectedEmployeeId,
}: {
	options: SalaryAdvanceFormOptionsResponse;
	preselectedEmployeeId?: string;
}) {
	const navigate = useNavigate();
	const mutation = useFormUpsert({
		upsertFn: (data: SalaryAdvanceCreateFormInput) => applyForSalaryAdvanceFn({ data }),
		entityName: "Salary advance",
		queryKey: ["salary-advances"],
		successMessage: {
			create: "Salary advance application submitted successfully.",
		},
		onSuccessCallback: (result) => {
			const warningMessage = result.warning;

			if (warningMessage) {
				toast((t) => (
					<ToastContent t={t} title="Review Warning" message={warningMessage} />
				));
			}

			form.reset();
			setTimeout(() => {
				navigate({
					to: "/app/payroll/salary-advances/$advanceId",
					params: {
						advanceId: result.advance.id,
					},
				});
			}, 0);
		},
	});

	const form = useAppForm({
		defaultValues: {
			...defaultValues,
			employeeId: preselectedEmployeeId ?? defaultValues.employeeId,
		},
		validators: {
			onSubmit: salaryAdvanceCreateFormSchema,
		},
		onSubmit: ({ value }) => mutation.mutate(value),
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	usePreventUnsavedChanges(isDirty);

	return (
		<div className="rounded-md border bg-card p-6 space-y-6">
			<PageHeader
				title="Apply For Salary Advance"
				description="Capture an employee request for an early salary payment and route it for HR approval."
			/>
			<form
				className="space-y-6"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="grid gap-4 md:grid-cols-2">
					<form.AppField name="employeeId">
						{(field) => (
							<field.Select label="Employee" required>
								{options.employees.map((employee) => (
									<SelectItem key={employee.id} value={employee.id}>
										{`E${employee.employeeNo} - ${employee.fullName}`}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="requestedAmount">
						{(field) => (
							<field.Input label="Requested Amount" type="number" min={0} step="0.01" required />
						)}
					</form.AppField>
					<form.AppField name="requestedRecoveryMonths">
						{(field) => (
							<field.Input
								label="Requested Recovery Months"
								type="number"
								min={1}
								max={3}
								step="1"
								required
							/>
						)}
					</form.AppField>
				</div>

				<form.AppField name="reason">
					{(field) => (
						<field.Textarea
							label="Reason"
							rows={4}
							placeholder="Explain why the salary advance is being requested."
						/>
					)}
				</form.AppField>

				<div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
					The request is submitted as pending. Approval creates the disbursement journal
					immediately, and payroll recoveries are then deducted automatically in later runs.
				</div>

				<form.AppForm>
					<form.SubmitButton
						buttonText="Submit Salary Advance Application"
						isLoading={mutation.isPending}
					/>
				</form.AppForm>
			</form>
		</div>
	);
}
