import { useQueries } from "@tanstack/react-query";
import { payrollPeriodQueries, salaryStructureQueries } from "../../services/queries";
import { useAppForm } from "@/lib/form";
import { bonusEntrySchema, bonusFormSchema } from "../../services/payroll-period.schemas";
import type { BonusEntry, BonusFormValues } from "../../services/payroll-period.schemas";
import { SelectItem } from "@/components/ui/select";
import { toTitleCase } from "@/lib/utils";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { XIcon } from "@/components/ui/icons";
import { currencyFormatter } from "@/lib/helpers";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { addPayrollPeriodBonusFn } from "../../services/payroll-slips.api";
import { useStore } from "@tanstack/react-form";
import toast from "react-hot-toast";
import { ToastContent } from "@/components/ui/toast-content";
import { Badge } from "@/components/ui/badge";
import { PAYROLL_PERIOD_STATUS } from "../../lib/payroll-constants";
import type { PayrollPeriodView } from "../../lib/payroll-period/types";

export function BonusForm({
	periodId,
	status,
}: {
	periodId: string;
	status: PayrollPeriodView["status"];
}) {
	const [{ data: bonuses }, { data: employees }] = useQueries({
		queries: [payrollPeriodQueries.bonuses({ periodId }), salaryStructureQueries.employees()],
	});
	const { mutate, isPending } = useFormUpsert({
		upsertFn: (value: BonusFormValues) => addPayrollPeriodBonusFn({ data: value }),
		entityName: "Bonuses",
		queryKey: ["payroll-periods", "bonuses", periodId],
	});
	const form = useAppForm({
		defaultValues: {
			periodId,
			employees: [] as BonusEntry[],
		} satisfies BonusFormValues,
		validators: {
			onSubmit: bonusFormSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value, {
				onSuccess: () => {
					form.reset();
				},
			});
		},
	});

	const employeeEntries = useStore(form.store, (state) => state.values.employees);
	const isEntriesAllowed = status === PAYROLL_PERIOD_STATUS.DRAFT;

	const draftForm = useAppForm({
		defaultValues: {
			employeeId: "",
			description: "",
		} as BonusEntry,
		validators: {
			onSubmit: bonusEntrySchema,
		},
		onSubmit: ({ value, formApi }) => {
			const employeeAdded = employeeEntries.some((entry) => entry.employeeId === value.employeeId);
			if (employeeAdded) {
				toast.error((t) => (
					<ToastContent t={t} message="Employee already added" title="Bonus Error" />
				));
				return;
			}
			form.pushFieldValue("employees", value);
			formApi.reset();
		},
	});

	return (
		<div className="space-y-6 border border-border rounded-md p-4 self-start">
			<header>
				<div className="flex flex-row justify-between gap-1 items-center">
					<h2 className="font-display text-base font-semibold">Bonuses</h2>
					<Badge variant={bonuses?.length ? "success" : "secondary"}>
						{bonuses?.length
							? `${bonuses?.length} ${bonuses?.length === 1 ? "bonus" : "bonuses"} already added: Total: ${currencyFormatter(bonuses?.reduce((acc, bonus) => acc + bonus.amount, 0))}`
							: "No bonuses added yet"}
					</Badge>
				</div>
				<p className="text-sm text-muted-foreground">
					{isEntriesAllowed
						? "Add bonuses to employees. Available before the period is approved."
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
							{(field) => <field.Input label="Description" fieldClassName="col-span-full" />}
						</draftForm.AppField>
					</FieldGroup>
					<FieldGroup className="flex flex-row justify-end">
						<Button type="button" variant="outline" onClick={() => draftForm.handleSubmit()}>
							Add Bonus
						</Button>
					</FieldGroup>

					<form.Field name="employees" mode="array">
						{(field) => (
							<ul className="divide-y divide-border border-t border-border bg-card rounded-b">
								{field.state.value.map((entry, index) => {
									const employeeName = employees?.find(
										(employee) => employee.id === entry.employeeId
									)?.fullName;
									return (
										<li key={index} className="flex items-center justify-between gap-3 px-4 py-2.5">
											<div className="min-w-0">
												<p className="truncate text-sm font-medium capitalize">{employeeName}</p>
												<p className="truncate text-xs text-muted-foreground">
													{entry.description || "No reason given"}
												</p>
											</div>
											<div className="flex items-center gap-3">
												<span className="text-sm font-semibold">
													{currencyFormatter(entry.amount)}
												</span>
												<Button
													size="icon-sm"
													variant="ghost"
													type="button"
													disabled={isPending}
													onClick={() => field.removeValue(index)}
												>
													<XIcon />
												</Button>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</form.Field>

					<form.Field name="employees">
						{(field) =>
							field.state.meta.errors.length > 0 ? (
								<p className="text-destructive text-sm">Check bonus entries for errors</p>
							) : null
						}
					</form.Field>

					<form.AppForm>
						<form.SubmitButton isLoading={isPending} buttonText="Save Bonus" />
					</form.AppForm>
				</form>
			)}
			{bonuses && bonuses.length > 0 && (
				<ul className="space-y-2">
					{bonuses.map((bonus, index) => {
						return (
							<ListItem
								key={bonus.id}
								amount={bonus.amount}
								description={bonus.description}
								employeeName={toTitleCase(bonus.employeeName)}
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
	description,
	employeeName,
	index,
	onRemove,
	isPending,
	isEntriesAllowed,
}: {
	isPending?: boolean;
	employeeName: string;
	amount: BonusEntry["amount"];
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
