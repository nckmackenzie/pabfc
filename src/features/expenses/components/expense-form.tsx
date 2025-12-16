import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { payeeQueries } from "@/features/expenses/services/queries";
import {
	type ExpenseSchema,
	expenseSchema,
} from "@/features/expenses/services/schemas";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useAppForm } from "@/lib/form";
import { transformOptions } from "@/lib/utils";
import { createExpense } from "../services/expenses.api";
import { AddPayee } from "./add-payee";

export function ExpenseForm() {
	const { accounts, payees: loaderPayees } = useRouteContext({
		from: "/app/expenses",
	});
	const { data: payees } = useQuery(payeeQueries.list());

	const { mutate, isPending } = useFormMutation({
		createFn: (values: ExpenseSchema) => createExpense({ data: values }),
		entityName: "Expense",
		queryKey: ["expenses"],
	});

	const form = useAppForm({
		defaultValues: {
			expenseNo: 1,
			expenseDate: new Date().toISOString(),
			payeeId: "",
			paymentMethod: "cash",
			reference: "",
			details: [],
		} as ExpenseSchema,
		validators: {
			onSubmit: expenseSchema,
		},
		onSubmit: ({ value }) => {
			console.log(value);
			mutate({ data: value });
		},
	});

	return (
		<div className="space-y-6">
			<PageHeader title="New Expense" description="Add a new expense" />
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
					<form.AppField name="expenseNo">
						{(field) => <field.Input readOnly label="Expense No" />}
					</form.AppField>
					<form.AppField name="expenseDate">
						{(field) => (
							<field.Input type="date" label="Expense Date" required />
						)}
					</form.AppField>
					<div className="col-span-full lg:col-span-2">
						<form.AppField name="payeeId">
							{(field) => (
								<field.Combobox
									label="Payee"
									required
									placeholder="Select Payee"
									items={transformOptions(payees || loaderPayees)}
									addNew={<AddPayee />}
								/>
							)}
						</form.AppField>
					</div>
					<form.AppField name="paymentMethod">
						{(field) => (
							<field.Select
								label="Payment Method"
								required
								placeholder="Select Payment Method"
							>
								{PAYMENT_METHODS.map((method) => (
									<SelectItem key={method.value} value={method.value}>
										{method.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="reference">
						{(field) => (
							<field.Input
								label="Reference"
								placeholder="Enter Reference"
								required
							/>
						)}
					</form.AppField>
				</FieldGroup>
				<Separator className="my-4" />
				<form.Field name="details" mode="array">
					{(field) => (
						<div className="space-y-4">
							<div className="flex md:items-center md:justify-between md:flex-row flex-col gap-4">
								<h2 className="text-lg font-semibold">Expense Details</h2>
								<ButtonGroup>
									<Button
										type="button"
										variant="secondary"
										onClick={() =>
											field.pushValue({
												accountId: "",
												quantity: 1,
												unitPrice: 0,
												vatType: "none",
												id: nanoid(),
											})
										}
									>
										<PlusIcon className="size-4" aria-hidden="true" />
										Add Line
									</Button>
									<Button
										type="button"
										variant="ghost"
										onClick={() => field.clearValues()}
										className="bg-destructive/20 text-destructive hover:bg-destructive/40"
									>
										<MinusIcon className="size-4" aria-hidden="true" />
										Clear Lines
									</Button>
								</ButtonGroup>
							</div>
							{field.state.value.map((item, index) => {
								const lineSubTotal =
									parseFloat(item.quantity?.toString() ?? "1") *
									parseFloat(item.unitPrice?.toString() ?? "0");
								return (
									<div className="p-4 border rounded-md" key={item.id}>
										<FieldGroup className="grid md:grid-cols-2 lg:grid-cols-12 gap-4">
											<div className="col-span-full lg:col-span-4">
												<form.AppField name={`details[${index}].accountId`}>
													{(field) => (
														<field.Select
															label="Account"
															required
															placeholder="Select Account"
														>
															{accounts.map((account) => (
																<SelectItem
																	key={account.id}
																	value={account.id.toString()}
																>
																	{account.name}
																</SelectItem>
															))}
														</field.Select>
													)}
												</form.AppField>
											</div>
											<form.AppField name={`details[${index}].quantity`}>
												{(field) => (
													<field.Input
														label="Quantity"
														type="number"
														required
													/>
												)}
											</form.AppField>
											<div className="col-span-full lg:col-span-2">
												<form.AppField name={`details[${index}].unitPrice`}>
													{(field) => (
														<field.Input
															type="number"
															label="Unit Price"
															required
														/>
													)}
												</form.AppField>
											</div>
											<div className="col-span-full lg:col-span-2">
												<form.AppField name={`details[${index}].vatType`}>
													{(field) => (
														<field.Select
															label="VAT Type"
															required
															placeholder="Select VAT Type"
														>
															<SelectItem value="none">None</SelectItem>
															<SelectItem value="inclusive">
																Inclusive
															</SelectItem>
															<SelectItem value="exclusive">
																Exclusive
															</SelectItem>
														</field.Select>
													)}
												</form.AppField>
											</div>
											<Field className="col-span-full lg:col-span-2">
												<FieldLabel>Total</FieldLabel>
												<Input
													value={new Intl.NumberFormat().format(lineSubTotal)}
													readOnly
												/>
											</Field>
											<Button
												type="button"
												variant="destructive"
												onClick={() => field.removeValue(index)}
												className="self-end"
												size="icon-lg"
											>
												<TrashIcon className="size-4" aria-hidden="true" />
											</Button>
										</FieldGroup>
									</div>
								);
							})}
						</div>
					)}
				</form.Field>
				<FieldGroup className="mt-4">
					<form.AppForm>
						<form.SubmitButton
							isLoading={isPending}
							buttonText="Submit"
							withReset
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
