import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
	deactivateSalaryStructureFn,
	updateSalaryStructureFn,
	type SalaryStructureDetailView,
} from "@/features/payroll/services/salary-structures.api";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { dateFormat, currencyFormatter } from "@/lib/helpers";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";
import toast from "react-hot-toast";

type MetadataFormValues = {
	id?: string;
	notes: string | null;
	pensionFundName: string | null;
	otherAllowancesDescription: string | null;
	hasHelbLoan: boolean;
	helbMonthlyDeduction: number;
};

export function SalaryStructureDetail({
	structure,
	employee,
}: {
	structure: SalaryStructureDetailView;
	employee: {
		id: string;
		employeeNo: string;
		fullName: string;
	};
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const metadataMutation = useFormUpsert({
		upsertFn: (data: MetadataFormValues) =>
			updateSalaryStructureFn({
				data: {
					structureId: structure.id,
					payload: {
						notes: data.notes,
						pensionFundName: data.pensionFundName,
						otherAllowancesDescription: data.otherAllowancesDescription,
						hasHelbLoan: data.hasHelbLoan,
						helbMonthlyDeduction: data.helbMonthlyDeduction,
					},
				},
			}),
		entityName: "Salary structure metadata",
		queryKey: ["salary-structures"],
		successMessage: {
			update: "Salary structure metadata updated successfully.",
		},
	});

	const metadataForm = useAppForm({
		defaultValues: {
			id: String(structure.id),
			notes: structure.notes,
			pensionFundName: structure.pensionFundName,
			otherAllowancesDescription: structure.otherAllowancesDescription,
			hasHelbLoan: structure.hasHelbLoan,
			helbMonthlyDeduction: Number(structure.helbMonthlyDeduction ?? 0),
		} satisfies MetadataFormValues,
		onSubmit: ({ value }) => metadataMutation.mutate(value),
	});

	const deactivateMutation = useMutation({
		mutationFn: async (effectiveTo: string) => {
			const result = await deactivateSalaryStructureFn({
				data: { structureId: structure.id, effectiveTo },
			});

			if (!result.success) {
				throw new Error(result.error.message);
			}

			return result.data;
		},
		onSuccess: async () => {
			toast.success("Salary structure deactivated successfully.");
			await queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
			navigate({
				to: "/app/payroll/salary-structures/employee/$employeeId",
				params: { employeeId: employee.id },
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to deactivate salary structure."
			);
		},
	});

	const deactivateForm = useAppForm({
		defaultValues: {
			id: String(structure.id),
			effectiveTo: structure.effectiveTo ?? new Date().toISOString().slice(0, 10),
		},
		onSubmit: ({ value }) => deactivateMutation.mutate(value.effectiveTo),
	});

	const isDirty = useStore(metadataForm.store, (state) => state.isDirty);
	usePreventUnsavedChanges(isDirty);

	const detailRows = [
		["Basic Salary", currencyFormatter(structure.computedComponents.basicSalary)],
		["House Allowance", currencyFormatter(structure.computedComponents.houseAllowance)],
		["Transport Allowance", currencyFormatter(structure.computedComponents.transportAllowance)],
		["Commuter Allowance", currencyFormatter(structure.computedComponents.commuterAllowance)],
		["Meal Allowance", currencyFormatter(structure.computedComponents.mealAllowance)],
		["Airtime Allowance", currencyFormatter(structure.computedComponents.airtimeAllowance)],
		["Other Allowances", currencyFormatter(structure.computedComponents.otherAllowances)],
		["Gross Pay", currencyFormatter(structure.computedComponents.grossPay)],
		["Meal Allowance Exempt", currencyFormatter(structure.computedComponents.mealAllowanceExempt)],
		[
			"Meal Allowance Taxable",
			currencyFormatter(structure.computedComponents.mealAllowanceTaxable),
		],
		[
			"Airtime Allowance Exempt",
			currencyFormatter(structure.computedComponents.airtimeAllowanceExempt),
		],
		[
			"Airtime Allowance Taxable",
			currencyFormatter(structure.computedComponents.airtimeAllowanceTaxable),
		],
		[
			"Pension Allowable Deduction",
			currencyFormatter(structure.computedComponents.pensionAllowableDeduction),
		],
		[
			"Mortgage Allowable Deduction",
			currencyFormatter(structure.computedComponents.mortgageAllowableDeduction),
		],
		[
			"Post-retirement Medical Deduction",
			currencyFormatter(structure.computedComponents.postRetirementAllowableDeduction),
		],
		[
			"Insurance Premiums For Relief",
			currencyFormatter(structure.computedComponents.insurancePremiumsForRelief),
		],
		["HELB Deduction", currencyFormatter(structure.computedComponents.helbMonthlyDeduction)],
		["Overtime Hourly Rate", currencyFormatter(structure.computedComponents.overtimeHourlyRate)],
	];

	return (
		<div className="space-y-6">
			<div className="rounded-md border bg-card p-6">
				<PageHeader
					title={`Salary Structure`}
					description={`Compensation breakdown for ${toTitleCase(employee.fullName)} (E${employee.employeeNo}).`}
				/>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<Badge variant="outline">
						{structure.effectiveFrom} to {structure.effectiveTo ?? "Current"}
					</Badge>
					<Badge variant={structure.effectiveTo ? "secondary" : "success"}>
						{structure.effectiveTo ? "Closed" : "Active"}
					</Badge>
					<Badge variant="outline">{toTitleCase(structure.payFrequency.replace("_", " "))}</Badge>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
				<div className="rounded-md border bg-card p-6 space-y-4">
					<h2 className="text-lg font-semibold">Payroll Breakdown</h2>
					<div className="grid gap-3 md:grid-cols-2">
						{detailRows.map(([label, value]) => (
							<div key={label} className="rounded-md border bg-muted/30 p-3">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
								<p className="mt-1 text-sm font-medium">{value}</p>
							</div>
						))}
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">
								Pension Fund Name
							</p>
							<p className="mt-1 text-sm font-medium">{structure.pensionFundName ?? "-"}</p>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</p>
							<p className="mt-1 text-sm font-medium">{dateFormat(structure.updatedAt, "long")}</p>
						</div>
					</div>
				</div>

				<div className="space-y-6">
					<div className="rounded-md border bg-card p-6 space-y-4">
						<h2 className="text-lg font-semibold">Editable Metadata</h2>
						<p className="text-sm text-muted-foreground">
							Financial values and dates are locked for audit integrity. Use a new salary structure
							for pay changes.
						</p>
						<form
							className="space-y-4"
							onSubmit={(event) => {
								event.preventDefault();
								event.stopPropagation();
								metadataForm.handleSubmit();
							}}
						>
							<metadataForm.AppField name="notes">
								{(field) => <field.Textarea label="Notes" rows={4} />}
							</metadataForm.AppField>
							<metadataForm.AppField name="pensionFundName">
								{(field) => <field.Input label="Pension Fund Name" />}
							</metadataForm.AppField>
							<metadataForm.AppField name="otherAllowancesDescription">
								{(field) => <field.Textarea label="Other Allowances Description" rows={3} />}
							</metadataForm.AppField>
							<metadataForm.AppField name="hasHelbLoan">
								{(field) => <field.Switch label="Has HELB Loan" />}
							</metadataForm.AppField>
							<metadataForm.AppField name="helbMonthlyDeduction">
								{(field) => (
									<field.Input label="HELB Deduction" type="number" min={0} step="0.01" />
								)}
							</metadataForm.AppField>
							<metadataForm.AppForm>
								<metadataForm.SubmitButton
									buttonText="Save Metadata"
									isLoading={metadataMutation.isPending}
								/>
							</metadataForm.AppForm>
						</form>
					</div>

					{!structure.effectiveTo ? (
						<div className="rounded-md border bg-card p-6 space-y-4">
							<h2 className="text-lg font-semibold">Deactivate Structure</h2>
							<p className="text-sm text-muted-foreground">
								Close this record when the employee stops using it, for example on termination or
								unpaid leave.
							</p>
							<form
								className="space-y-4"
								onSubmit={(event) => {
									event.preventDefault();
									event.stopPropagation();
									deactivateForm.handleSubmit();
								}}
							>
								<deactivateForm.AppField name="effectiveTo">
									{(field) => <field.Input label="Effective To" type="date" required />}
								</deactivateForm.AppField>
								<Button type="submit" variant="destructive" disabled={deactivateMutation.isPending}>
									Deactivate Structure
								</Button>
							</form>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
