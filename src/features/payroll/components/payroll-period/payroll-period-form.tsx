import { useAppForm } from "@/lib/form";
import { payrollPeriodCreateFormSchema } from "../../services/payroll-period.schemas";
import type { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { format } from "date-fns";
import { FieldGroup } from "@/components/ui/field";
import { useStore } from "@tanstack/react-form";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { createPayrollPeriodFn } from "../../services/payroll-periods.api";
import { useNavigate } from "@tanstack/react-router";

export const MONTHS = Array.from({ length: 12 }, (_, i) => {
	return {
		value: i + 1,
		label: format(new Date(new Date().getFullYear(), i, 1), "MMMM"),
	};
});

export function PayrollPeriodForm({
	periodData,
}: {
	periodData?: z.infer<typeof payrollPeriodCreateFormSchema>;
}) {
	const isEdit = Boolean(periodData);
	const navigate = useNavigate({ from: "/app/payroll/periods/" });
	const form = useAppForm({
		defaultValues:
			periodData ??
			({
				periodYear: new Date().getFullYear(),
				periodMonth: String(new Date().getMonth() + 1),
			} as z.infer<typeof payrollPeriodCreateFormSchema>),
		validators: {
			onSubmit: payrollPeriodCreateFormSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value);
		},
	});

	const [isDirty] = useStore(form.store, (state) => [state.isDirty]);

	const { isPending, mutate } = useFormUpsert({
		upsertFn: (values: z.infer<typeof payrollPeriodCreateFormSchema>) =>
			createPayrollPeriodFn({ data: values }),
		entityName: "Payroll period",
		queryKey: ["payroll-periods"],
		onSuccessCallback: (data) => {
			form.reset();

			setTimeout(() => {
				navigate({
					to: "/app/payroll/periods/$periodId",
					params: { periodId: data.period.id },
				});
			}, 100);
		},
	});

	usePreventUnsavedChanges(isDirty);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="flex flex-col gap-4 bg-card max-w-xl w-full p-6 rounded-md"
		>
			<PageHeader
				title={isEdit ? "Edit payroll period" : "Add payroll period"}
				description={isEdit ? "Edit payroll period" : "Add a new payroll period"}
			/>
			<form.AppField name="periodYear">
				{(field) => <field.Input maxLength={4} label="Year" type="number" min={2026} />}
			</form.AppField>
			<FieldGroup className="flex flex-col gap-6">
				<form.AppField name="periodMonth">
					{(field) => (
						<field.Select label="Month">
							{MONTHS.map((month) => (
								<SelectItem key={month.value} value={String(month.value)}>
									{month.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="payDate">
					{(field) => <field.Input label="Pay Date" type="date" />}
				</form.AppField>
			</FieldGroup>
			<FieldGroup>
				<form.AppForm>
					<form.SubmitButton
						isLoading={isPending}
						buttonText={isEdit ? "Update period" : "Create Period"}
					/>
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}
