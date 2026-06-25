import { useQueries } from "@tanstack/react-query";
import { payrollPeriodQueries, salaryStructureQueries } from "../../services/queries";
import { useAppForm } from "@/lib/form";
import {
	payrollPeriodOtherDeductionCreateSchema,
	payrollPeriodOtherDeductionEntrySchema,
} from "../../services/payroll-period.schemas";
import type { DeductionEntry, DeductionFormValues } from "../../services/payroll-period.schemas";
import { SelectItem } from "@/components/ui/select";
import { toTitleCase } from "@/lib/utils";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { XIcon } from "@/components/ui/icons";
import { currencyFormatter, toNumber } from "@/lib/helpers";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { addPayrollPeriodOtherDeductionFn } from "../../services/payroll-slips.api";
import { useStore } from "@tanstack/react-form";
import toast from "react-hot-toast";
import { ToastContent } from "@/components/ui/toast-content";
import { Badge } from "@/components/ui/badge";
import type { PayrollPeriodView } from "../../lib/payroll-period/types";
import { PAYROLL_PERIOD_STATUS } from "../../lib/payroll-constants";
import { formatText } from "@/features/employees/utils/helpers";
import { PAYROLL_OTHER_DEDUCTION_TYPES } from "../../services/payroll-slips.schemas";

export function PeriodDeductions({
	periodId,
	status,
}: {
	periodId: string;
	status: PayrollPeriodView["status"];
}) {
	const [{ data: deductions }, { data: employees }] = useQueries({
		queries: [payrollPeriodQueries.deductions({ periodId }), salaryStructureQueries.employees()],
	});
	const { mutate, isPending } = useFormUpsert({
		upsertFn: (value: DeductionFormValues) => addPayrollPeriodOtherDeductionFn({ data: value }),
		entityName: "Deductions",
		queryKey: ["payroll-periods", "deductions", periodId],
	});
	const form = useAppForm({
		defaultValues: {
			payrollPeriodId: periodId,
			deductions: [] as DeductionEntry[],
		} satisfies DeductionFormValues,
		validators: {
			onSubmit: payrollPeriodOtherDeductionCreateSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value, {
				onSuccess: () => {
					form.reset();
				},
			});
		},
	});

	const employeeEntries = useStore(form.store, (state) => state.values.deductions);

	const draftForm = useAppForm({
		defaultValues: {
			employeeId: "",
			description: "",
		} as DeductionEntry,
		validators: {
			onSubmit: payrollPeriodOtherDeductionEntrySchema,
		},
		onSubmit: ({ value, formApi }) => {
			const employeeAdded = employeeEntries.some((entry) => entry.employeeId === value.employeeId);
			if (employeeAdded) {
				toast.error((t) => (
					<ToastContent t={t} message="Employee already added" title="Bonus Error" />
				));
				return;
			}
			form.pushFieldValue("deductions", value);
			formApi.reset();
		},
	});

	const isEntriesAllowed = status === PAYROLL_PERIOD_STATUS.DRAFT;

	return (
		<div className="space-y-6 border border-border rounded-md p-4 self-start">
			<header>
				<div className="flex flex-row justify-between">
					<h2 className="font-display text-base font-semibold">Deductions</h2>
					<Badge variant={deductions?.length ? "success" : "secondary"}>
						{deductions?.length
							? `${deductions?.length} ${deductions?.length === 1 ? "deduction" : "deductions"} already added`
							: "No deductions for this period!"}
					</Badge>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					{isEntriesAllowed
						? "Add deductions to employees. Available before the period is approved."
						: "Locked after approval."}
				</p>
			</header>
			{isEntriesAllowed && (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<FieldGroup className="grid md:grid-cols-2 gap-4">
						<draftForm.AppField name="employeeId">
							{(field) => (
								<field.Select label="Employee">
									{employees?.map((employee) => (
										<SelectItem key={employee.id} value={employee.id}>
											{toTitleCase(employee.fullName)}
										</SelectItem>
									))}
								</field.Select>
							)}
						</draftForm.AppField>
						<draftForm.AppField name="amount">
							{(field) => <field.Input type="number" label="Amount" />}
						</draftForm.AppField>
						<draftForm.AppField name="description">
							{(field) => <field.Input label="Description" />}
						</draftForm.AppField>
						<draftForm.AppField name="deductionType">
							{(field) => (
								<field.Select label="Deduction Type">
									{PAYROLL_OTHER_DEDUCTION_TYPES?.map((d) => (
										<SelectItem key={d} value={d}>
											{formatText(d)}
										</SelectItem>
									))}
								</field.Select>
							)}
						</draftForm.AppField>
					</FieldGroup>
					<FieldGroup className="flex flex-row justify-end">
						<Button type="button" variant="outline" onClick={() => draftForm.handleSubmit()}>
							Add Deduction
						</Button>
					</FieldGroup>

					<form.Field name="deductions" mode="array">
						{(field) => (
							<ul className="divide-y divide-border border-t border-border bg-card rounded-b">
								{field.state.value.map((entry, index) => {
									const employeeName = employees?.find(
										(employee) => employee.id === entry.employeeId
									)?.fullName;
									if (!employeeName) return null;
									return (
										<ListItem
											key={index}
											amount={entry.amount}
											deductionType={entry.deductionType}
											description={entry.description}
											employeeName={employeeName}
											index={index}
											onRemove={field.removeValue}
											isEntriesAllowed={isEntriesAllowed}
											isPending={isPending}
										/>
									);
								})}
							</ul>
						)}
					</form.Field>

					<form.Field name="deductions">
						{(field) =>
							field.state.meta.errors.length > 0 ? (
								<p className="text-destructive text-sm">Check deduction entries for errors</p>
							) : null
						}
					</form.Field>
					<form.AppForm>
						<form.SubmitButton
							buttonVariant="secondary"
							isLoading={isPending}
							buttonText="SaveDeduction"
						/>
					</form.AppForm>
				</form>
			)}
			{deductions && deductions.length > 0 && (
				<ul className="space-y-2">
					{deductions.map((deduction, index) => {
						return (
							<ListItem
								key={deduction.id}
								amount={toNumber(deduction.amount)}
								deductionType={
									formatText(deduction.deductionType) as DeductionEntry["deductionType"]
								}
								description={deduction.description}
								employeeName={
									toTitleCase(deduction.employee?.firstName) +
									" " +
									toTitleCase(deduction.employee?.lastName)
								}
								index={index}
								isPending={isPending}
							/>
						);
					})}
				</ul>
			)}
		</div>
	);
}

function ListItem({
	amount,
	deductionType,
	description,
	employeeName,
	index,
	onRemove,
	isPending,
	isEntriesAllowed,
}: {
	isPending?: boolean;
	employeeName: string;
	deductionType: DeductionEntry["deductionType"];
	amount: DeductionEntry["amount"];
	description: string;
	index: number;
	onRemove?: (index: number) => void;
	isEntriesAllowed?: boolean;
}) {
	return (
		<li className="flex items-center justify-between gap-3 px-4 py-2.5 border rounded-md">
			<div className="min-w-0">
				<div className="flex items-center flex-row gap-3">
					<p className="truncate text-sm font-medium capitalize">{employeeName}</p>
					<Badge variant="outline">{formatText(deductionType)}</Badge>
				</div>
				<p className="truncate text-xs text-muted-foreground">{description || "No reason given"}</p>
			</div>
			<div className="flex items-center gap-3">
				<span className="text-sm font-semibold">{currencyFormatter(amount)}</span>
				{Boolean(isEntriesAllowed) && (
					<Button
						size="icon-sm"
						variant="ghost"
						type="button"
						disabled={isPending}
						onClick={() => onRemove?.(index)}
					>
						<XIcon />
					</Button>
				)}
			</div>
		</li>
	);
}
