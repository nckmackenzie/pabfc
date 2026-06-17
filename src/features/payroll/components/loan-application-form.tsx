import { useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { applyForLoanFn, type LoanFormOptionsResponse } from "@/features/payroll/services/loans.api";
import {
	loanCreateFormSchema,
	type LoanCreateFormInput,
} from "@/features/payroll/services/loan.schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";

const defaultValues: LoanCreateFormInput = {
	id: undefined,
	employeeId: "",
	principalAmount: 0,
	requestedInstalments: 12,
	purpose: null,
	annualInterestRate: 0,
};

export function LoanApplicationForm({
	options,
	preselectedEmployeeId,
}: {
	options: LoanFormOptionsResponse;
	preselectedEmployeeId?: string;
}) {
	const navigate = useNavigate();
	const mutation = useFormUpsert({
		upsertFn: (data: LoanCreateFormInput) => applyForLoanFn({ data }),
		entityName: "Employee loan",
		queryKey: ["employee-loans"],
		successMessage: {
			create: "Loan application submitted successfully.",
		},
		onSuccessCallback: (result) => {
			form.reset();
			setTimeout(() => {
				navigate({
					to: "/app/payroll/loans/$loanId",
					params: {
						loanId: result.loan.id,
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
			onSubmit: loanCreateFormSchema,
		},
		onSubmit: ({ value }) => mutation.mutate(value),
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	usePreventUnsavedChanges(isDirty);

	return (
		<div className="rounded-md border bg-card p-6 space-y-6">
			<PageHeader
				title="Apply For Employee Loan"
				description="Capture a loan request and store the repayment proposal for HR review and approval."
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
					<form.AppField name="principalAmount">
						{(field) => (
							<field.Input label="Principal Amount" type="number" min={0} step="0.01" required />
						)}
					</form.AppField>
					<form.AppField name="requestedInstalments">
						{(field) => (
							<field.Input
								label="Requested Instalments"
								type="number"
								min={1}
								max={60}
								step="1"
								required
							/>
						)}
					</form.AppField>
					<form.AppField name="annualInterestRate">
						{(field) => (
							<field.Input
								label="Annual Interest Rate"
								type="number"
								min={0}
								max={1}
								step="0.0001"
								helperText="Enter a decimal, for example 0.1 for 10% or 0 for interest-free."
							/>
						)}
					</form.AppField>
				</div>

				<form.AppField name="purpose">
					{(field) => (
						<field.Textarea
							label="Purpose"
							rows={4}
							placeholder="Explain why the loan is being requested."
						/>
					)}
				</form.AppField>

				<div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
					The repayment schedule is computed automatically and will be available on the loan detail
					page for HR review before approval.
				</div>

				<form.AppForm>
					<form.SubmitButton
						buttonText="Submit Loan Application"
						isLoading={mutation.isPending}
					/>
				</form.AppForm>
			</form>
		</div>
	);
}
