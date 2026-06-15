import { useStore } from "@tanstack/react-form";
import { SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import {
	createSalaryStructureFn,
	type SalaryStructureEmployeeOption,
} from "@/features/payroll/services/salary-structures.api";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";
import toast from "react-hot-toast";
import {
	type SalaryStructureCreateFormInput,
	salaryStructureCreateSchema,
} from "../services/schemas";

const PAY_FREQUENCY_OPTIONS = [
	{ value: "monthly", label: "Monthly" },
	{ value: "bi_weekly", label: "Bi Weekly" },
	{ value: "weekly", label: "Weekly" },
] as const;

const defaultValues = {
	id: undefined,
	employeeId: "",
	effectiveFrom: new Date().toISOString().slice(0, 10),
	effectiveTo: null,
	payFrequency: "monthly",
	basicSalary: 0,
	houseAllowance: 0,
	transportAllowance: 0,
	commuterAllowance: 0,
	mealAllowance: 0,
	airtimeAllowance: 0,
	otherAllowances: 0,
	otherAllowancesDescription: null,
	pensionEmployeeContribution: 0,
	pensionEmployerContribution: 0,
	pensionFundName: null,
	mortgageInterestMonthly: 0,
	postRetirementMedicalMonthly: 0,
	insurancePremiumsMonthly: 0,
	hasHelbLoan: false,
	helbMonthlyDeduction: 0,
	normalHoursPerDay: 8,
	normalDaysPerWeek: 5,
	overtimeHourlyRateDivisor: 225,
	notes: null,
};

export function SalaryStructureForm({
	employees,
	preselectedEmployeeId,
}: {
	employees: Array<SalaryStructureEmployeeOption>;
	preselectedEmployeeId?: string;
}) {
	const mutation = useFormUpsert({
		upsertFn: (data: SalaryStructureCreateFormInput) => createSalaryStructureFn({ data }),
		entityName: "Salary structure",
		navigateTo: "/app/payroll/salary-structures",
		queryKey: ["salary-structures"],
		successMessage: {
			create: "Salary structure created successfully.",
		},
		onSuccessCallback: (result) => {
			if (result.warnings.length > 0) {
				toast.error(result.warnings.join(" "));
			}
		},
		onReset: () => form.reset(),
	});

	const form = useAppForm({
		defaultValues: {
			...defaultValues,
			employeeId: preselectedEmployeeId ?? defaultValues.employeeId,
		} as SalaryStructureCreateFormInput,
		validators: {
			onSubmit: salaryStructureCreateSchema,
		},
		onSubmit: ({ value }) => {
			mutation.mutate(value);
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	usePreventUnsavedChanges(isDirty);

	return (
		<div className="bg-card border rounded-md p-6 space-y-6">
			<PageHeader
				title="Add Salary Structure"
				description="Create a new effective-dated compensation record for payroll processing."
			/>
			<form
				className="space-y-8"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="grid gap-4 md:grid-cols-3">
					<form.AppField name="employeeId">
						{(field) => (
							<field.Select label="Employee" required>
								{employees.map((employee) => (
									<SelectItem key={employee.id} value={employee.id}>
										{`E${employee.employeeNo} - ${toTitleCase(employee.fullName)}`}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="effectiveFrom">
						{(field) => <field.Input label="Effective From" type="date" required />}
					</form.AppField>
					<form.AppField name="effectiveTo">
						{(field) => <field.Input label="Effective To" type="date" />}
					</form.AppField>
					<form.AppField name="payFrequency">
						{(field) => (
							<field.Select label="Pay Frequency" required>
								{PAY_FREQUENCY_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
				</div>

				<section className="space-y-4">
					<div>
						<h2 className="text-base font-semibold">Earnings</h2>
						<p className="text-sm text-muted-foreground">
							Set the recurring earning components that make up gross pay.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<form.AppField name="basicSalary">
							{(field) => (
								<field.Input label="Basic Salary" type="number" min={0} step="0.01" required />
							)}
						</form.AppField>
						<form.AppField name="houseAllowance">
							{(field) => <field.Input label="House Allowance" type="number" min={0} step="0.01" />}
						</form.AppField>
						<form.AppField name="transportAllowance">
							{(field) => (
								<field.Input label="Transport Allowance" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="commuterAllowance">
							{(field) => (
								<field.Input label="Commuter Allowance" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="mealAllowance">
							{(field) => (
								<field.Input
									label="Meal Allowance"
									type="number"
									min={0}
									step="0.01"
									helperText="First KES 5,000 per month is PAYE-exempt."
								/>
							)}
						</form.AppField>
						<form.AppField name="airtimeAllowance">
							{(field) => (
								<field.Input
									label="Airtime Allowance"
									type="number"
									min={0}
									step="0.01"
									helperText="First KES 5,000 per month is PAYE-exempt."
								/>
							)}
						</form.AppField>
						<form.AppField name="otherAllowances">
							{(field) => (
								<field.Input label="Other Allowances" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
					</div>
					<form.AppField name="otherAllowancesDescription">
						{(field) => (
							<field.Textarea
								label="Other Allowances Description"
								placeholder="Describe what the other allowances cover"
								rows={3}
							/>
						)}
					</form.AppField>
				</section>

				<section className="space-y-4">
					<div>
						<h2 className="text-base font-semibold">Tax Relief Inputs</h2>
						<p className="text-sm text-muted-foreground">
							These values influence PAYE allowable deductions and credits later in payroll.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<form.AppField name="pensionEmployeeContribution">
							{(field) => (
								<field.Input
									label="Employee Pension Contribution"
									type="number"
									min={0}
									step="0.01"
									helperText="PAYE allowable up to KES 30,000 per month."
								/>
							)}
						</form.AppField>
						<form.AppField name="pensionEmployerContribution">
							{(field) => (
								<field.Input
									label="Employer Pension Contribution"
									type="number"
									min={0}
									step="0.01"
								/>
							)}
						</form.AppField>
						<form.AppField name="mortgageInterestMonthly">
							{(field) => (
								<field.Input
									label="Mortgage Interest"
									type="number"
									min={0}
									step="0.01"
									helperText="PAYE allowable up to KES 30,000 per month."
								/>
							)}
						</form.AppField>
						<form.AppField name="postRetirementMedicalMonthly">
							{(field) => (
								<field.Input
									label="Post-retirement Medical"
									type="number"
									min={0}
									step="0.01"
									helperText="PAYE allowable up to KES 15,000 per month."
								/>
							)}
						</form.AppField>
						<form.AppField name="insurancePremiumsMonthly">
							{(field) => (
								<field.Input
									label="Insurance Premiums"
									type="number"
									min={0}
									step="0.01"
									helperText="Used later to compute insurance relief."
								/>
							)}
						</form.AppField>
						<form.AppField name="pensionFundName">
							{(field) => <field.Input label="Pension Fund Name" />}
						</form.AppField>
					</div>
				</section>

				<section className="space-y-4">
					<div>
						<h2 className="text-base font-semibold">HELB and Working Hours</h2>
						<p className="text-sm text-muted-foreground">
							These settings support statutory deductions and overtime calculations.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<form.AppField name="hasHelbLoan">
							{(field) => <field.Switch label="Has HELB Loan" />}
						</form.AppField>
						<form.AppField name="helbMonthlyDeduction">
							{(field) => <field.Input label="HELB Deduction" type="number" min={0} step="0.01" />}
						</form.AppField>
						<form.AppField name="normalHoursPerDay">
							{(field) => (
								<field.Input label="Normal Hours Per Day" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="normalDaysPerWeek">
							{(field) => (
								<field.Input label="Normal Days Per Week" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="overtimeHourlyRateDivisor">
							{(field) => (
								<field.Input label="Overtime Rate Divisor" type="number" min={1} step="1" />
							)}
						</form.AppField>
					</div>
				</section>

				<form.AppField name="notes">
					{(field) => (
						<field.Textarea
							label="Notes"
							placeholder="Add any context for this salary structure change"
							rows={4}
						/>
					)}
				</form.AppField>

				<form.AppForm>
					<form.SubmitButton
						buttonText="Create Salary Structure"
						isLoading={mutation.isPending}
						withReset
					/>
				</form.AppForm>
			</form>
		</div>
	);
}
