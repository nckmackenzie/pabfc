import { useStore } from "@tanstack/react-form";
import { useQueries } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { nanoid } from "nanoid";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import CustomModal from "@/components/ui/custom-modal";
import { FieldGroup } from "@/components/ui/field";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { SelectItem } from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { vatTypes } from "@/drizzle/schema";
import { VendorForm } from "@/features/bills/components/vendor-form";
import { upsertBill } from "@/features/bills/services/bills.api";
import { supplierQueries } from "@/features/bills/services/queries";
import { type BillSchema, billSchema } from "@/features/bills/services/schemas";
import { accountQueries } from "@/features/coa/services/queries";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";
import type { Option } from "@/types/index.types";

type BillForm = {
	loaderVendors: Array<Option>;
	loaderAccounts: Array<Option>;
	bill?: BillSchema;
	isEdit?: boolean;
};

const defaultLine = {
	expenseAccountId: "",
	vatType: "none" as const,
	amount: 0,
	description: "",
	id: nanoid(),
};

const defaultValues = {
	invoiceDate: dateFormat(new Date()),
	vendorId: "",
	invoiceNo: "",
	isRecurring: false,
	dueDate: null,
	lines: [defaultLine],
	terms: null,
} as BillSchema;

export function BillForm({
	loaderVendors,
	loaderAccounts,
	bill,
	isEdit,
}: BillForm) {
	const [{ data: accounts }, { data: vendors }] = useQueries({
		queries: [
			accountQueries.activeChildAccountsByAccountType("expense"),
			supplierQueries.active(),
		],
	});

	const { isPending, mutate } = useFormUpsert({
		upsertFn: (values: BillSchema) => upsertBill({ data: values }),
		entityName: "Bill",
		queryKey: ["bills"],
		navigateTo: "/app/bills",
	});

	const form = useAppForm({
		defaultValues: bill || defaultValues,
		validators: {
			onSubmit: billSchema,
		},
		onSubmit: async ({ value }) => {
			mutate({ ...value, id: bill?.id });
		},
	});

	const [isRecurring, lines, terms, invoiceDate] = useStore(
		form.store,
		(state) => [
			state.values.isRecurring,
			state.values.lines,
			state.values.terms,
			state.values.invoiceDate,
		],
	);
	const totalAmount = lines.reduce((acc, line) => acc + Number(line.amount), 0);
	const { setOpen } = useModal();

	const handleAddNewVendor = () => {
		setOpen(
			<CustomModal title="Add New Vendor" className="max-w-3xl! w-full!">
				<VendorForm fromModal={true} />
			</CustomModal>,
		);
	};

	useEffect(() => {
		if (!invoiceDate || !terms || bill) return;
		const dueDate = (daysToAdd: number) => {
			return dateFormat(addDays(new Date(invoiceDate), daysToAdd));
		};
		if (terms === "Net 30") {
			form.setFieldValue("dueDate", dueDate(30));
		} else if (terms === "Net 60") {
			form.setFieldValue("dueDate", dueDate(60));
		} else if (terms === "Net 90") {
			form.setFieldValue("dueDate", dueDate(90));
		} else if (terms === "Due on Receipt") {
			form.setFieldValue("dueDate", dateFormat(new Date()));
		}
	}, [terms, form, invoiceDate, bill]);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
				<form.AppField name="vendorId">
					{(field) => (
						<field.Combobox
							label="Vendor"
							placeholder="Select vendor"
							addNew={
								<Button
									className="w-full"
									type="button"
									variant="ghost"
									onClick={handleAddNewVendor}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Vendor
								</Button>
							}
							items={vendors || loaderVendors}
							required
						/>
					)}
				</form.AppField>
				<form.AppField name="invoiceDate">
					{(field) => <field.Input type="date" label="Invoice Date" required />}
				</form.AppField>

				<form.AppField name="terms">
					{(field) => (
						<field.Select label="Terms" required>
							<SelectItem value="Net 30">Net 30</SelectItem>
							<SelectItem value="Net 60">Net 60</SelectItem>
							<SelectItem value="Net 90">Net 90</SelectItem>
							<SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="dueDate">
					{(field) => <field.Input type="date" label="Due Date" />}
				</form.AppField>
				<form.AppField name="invoiceNo">
					{(field) => <field.Input label="Invoice#" required />}
				</form.AppField>
			</FieldGroup>
			<FieldGroup className="grid gap-4">
				<form.AppField name="isRecurring">
					{(field) => <field.Switch label="Recurring Bill" />}
				</form.AppField>
				<div className="grid md:grid-cols-2 gap-4">
					{isRecurring && (
						<div className="flex flex-col md:flex-row gap-4">
							<form.AppField name="recurrencePattern">
								{(field) => (
									<field.Select label="Recurrence Pattern">
										<SelectItem value="daily">Daily</SelectItem>
										<SelectItem value="weekly">Weekly</SelectItem>
										<SelectItem value="monthly">Monthly</SelectItem>
										<SelectItem value="yearly">Yearly</SelectItem>
									</field.Select>
								)}
							</form.AppField>
							<form.AppField name="recurrenceEndDate">
								{(field) => (
									<field.Input type="date" label="Recurrence End Date" />
								)}
							</form.AppField>
						</div>
					)}
				</div>
			</FieldGroup>
			<form.Field name="lines" mode="array">
				{(field) => (
					<div className="space-y-4">
						<div className="flex md:items-center md:justify-end md:flex-row flex-col gap-4">
							<ButtonGroup>
								<Button
									type="button"
									variant="secondary"
									onClick={() =>
										field.pushValue({ ...defaultLine, id: nanoid() })
									}
									disabled={isPending}
								>
									<PlusIcon className="size-4" aria-hidden="true" />
									Add Line
								</Button>
								<Button
									type="button"
									variant="ghost"
									onClick={() => field.clearValues()}
									className="bg-destructive/10 text-destructive hover:bg-destructive/40"
									disabled={isPending}
								>
									<MinusIcon className="size-4" aria-hidden="true" />
									Clear Lines
								</Button>
							</ButtonGroup>
						</div>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[300px]">Account</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="w-[180px]">Amount</TableHead>
									<TableHead className="w-[180px]">Tax</TableHead>
									<TableHead className="w-24"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{field.state.value.map((line, index) => (
									<TableRow key={line.id}>
										<TableCell>
											<form.AppField name={`lines[${index}].expenseAccountId`}>
												{(field) => (
													<field.Select label="">
														{(accounts || loaderAccounts).map((account) => (
															<SelectItem
																key={account.value}
																value={account.value}
															>
																{account.label}
															</SelectItem>
														))}
													</field.Select>
												)}
											</form.AppField>
										</TableCell>
										<TableCell>
											<form.AppField name={`lines[${index}].description`}>
												{(field) => <field.Input label="" />}
											</form.AppField>
										</TableCell>
										<TableCell>
											<form.AppField name={`lines[${index}].amount`}>
												{(field) => (
													<field.Input
														type="number"
														value={
															field.state.value === 0 ? "" : field.state.value
														}
														label=""
													/>
												)}
											</form.AppField>
										</TableCell>
										<TableCell>
											<form.AppField name={`lines[${index}].vatType`}>
												{(field) => (
													<field.Select label="">
														{vatTypes.map((vatType) => (
															<SelectItem key={vatType} value={vatType}>
																{toTitleCase(vatType)}
															</SelectItem>
														))}
													</field.Select>
												)}
											</form.AppField>
										</TableCell>
										<TableCell>
											<Button
												type="button"
												variant="ghost"
												onClick={() => field.removeValue(index)}
												disabled={isPending}
											>
												<TrashIcon
													className="size-4 text-destructive"
													aria-hidden="true"
												/>
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
							{lines.length > 0 && (
								<TableFooter>
									<TableRow>
										<TableCell className="text-right font-bold" colSpan={2}>
											Total
										</TableCell>
										<TableCell className="text-right font-bold">
											{currencyFormatter(
												Number.isNaN(totalAmount) ? 0 : totalAmount,
												false,
											)}
										</TableCell>
										<TableCell colSpan={2} />
									</TableRow>
								</TableFooter>
							)}
						</Table>
					</div>
				)}
			</form.Field>
			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					buttonText={isEdit ? "Update Bill" : "Create Bill"}
					withReset
				/>
			</form.AppForm>
		</form>
	);
}
