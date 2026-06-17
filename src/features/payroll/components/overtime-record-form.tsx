import { useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import {
	createOvertimeRecordFn,
	type OvertimeFormOptionsResponse,
} from "@/features/payroll/services/overtime.api";
import {
	overtimeRecordCreateFormSchema,
	type OvertimeRecordCreateFormInput,
} from "@/features/payroll/services/overtime.schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";
import toast from "react-hot-toast";

const currentDate = new Date();

const defaultValues: OvertimeRecordCreateFormInput = {
	id: undefined,
	employeeId: "",
	periodMonth: currentDate.getUTCMonth() + 1,
	periodYear: currentDate.getUTCFullYear(),
	weekdayOvertimeHours: 0,
	weekendOvertimeHours: 0,
	publicHolidayOvertimeHours: 0,
	notes: null,
};

export function OvertimeRecordForm({
	options,
	preselectedEmployeeId,
}: {
	options: OvertimeFormOptionsResponse;
	preselectedEmployeeId?: string;
}) {
	const navigate = useNavigate();
	const mutation = useFormUpsert({
		upsertFn: (data: OvertimeRecordCreateFormInput) => createOvertimeRecordFn({ data }),
		entityName: "Overtime record",
		queryKey: ["overtime-records"],
		successMessage: {
			create: "Overtime record created successfully.",
		},
		onSuccessCallback: (result) => {
			if (result.warnings.length > 0) {
				toast.error(result.warnings.join(" "));
			}

			form.reset();

			setTimeout(() => {
				navigate({
					to: "/app/payroll/overtime/$recordId",
					params: {
						recordId: result.record.id,
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
			onSubmit: overtimeRecordCreateFormSchema,
		},
		onSubmit: ({ value }) => {
			mutation.mutate(value);
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	usePreventUnsavedChanges(isDirty);

	return (
		<div className="rounded-md border bg-card p-6 space-y-6">
			<PageHeader
				title="Add Overtime Record"
				description="Capture monthly overtime hours. Pay values are computed automatically from the employee's active salary structure."
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
								{options.employees.map((employee) => (
									<SelectItem key={employee.id} value={employee.id}>
										{`E${employee.employeeNo} - ${toTitleCase(employee.fullName)}`}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="periodMonth">
						{(field) => (
							<field.Input label="Period Month" type="number" min={1} max={12} required />
						)}
					</form.AppField>
					<form.AppField name="periodYear">
						{(field) => (
							<field.Input label="Period Year" type="number" min={2000} max={2100} required />
						)}
					</form.AppField>
				</div>

				<section className="space-y-4">
					<div>
						<h2 className="text-base font-semibold">Overtime Hours</h2>
						<p className="text-sm text-muted-foreground">
							Enter only hours worked. Weekday hours use 1.5x, weekend and public holiday hours use
							2.0x.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<form.AppField name="weekdayOvertimeHours">
							{(field) => (
								<field.Input
									label="Weekday Overtime Hours"
									type="number"
									min={0}
									step="0.01"
									required
								/>
							)}
						</form.AppField>
						<form.AppField name="weekendOvertimeHours">
							{(field) => (
								<field.Input
									label="Weekend Overtime Hours"
									type="number"
									min={0}
									step="0.01"
									required
								/>
							)}
						</form.AppField>
						<form.AppField name="publicHolidayOvertimeHours">
							{(field) => (
								<field.Input
									label="Public Holiday Overtime Hours"
									type="number"
									min={0}
									step="0.01"
									required
								/>
							)}
						</form.AppField>
					</div>
				</section>

				<form.AppField name="notes">
					{(field) => (
						<field.Textarea
							label="Notes"
							placeholder="Add context for the overtime entry, for example extra training sessions or event cover."
							rows={4}
						/>
					)}
				</form.AppField>

				<div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
					The system will snapshot the overtime hourly rate from the employee's active salary
					structure for the selected month and compute all pay fields automatically.
				</div>

				<form.AppForm>
					<form.SubmitButton buttonText="Create Overtime Record" isLoading={mutation.isPending} />
				</form.AppForm>
			</form>
		</div>
	);
}
