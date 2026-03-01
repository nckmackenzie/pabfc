import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FormUploader } from "@/components/ui/form-uploader";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AddPayee } from "@/features/expenses/components/add-payee";
import {
	createExpense,
	type getExpense,
} from "@/features/expenses/services/expenses.api";
import { payeeQueries } from "@/features/expenses/services/queries";
import {
	type ExpenseSchema,
	expenseSchema,
} from "@/features/expenses/services/schemas";
import { calculateExpenseRequest } from "@/features/expenses/utils";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useAppForm } from "@/lib/form";
import { currencyFormatter } from "@/lib/helpers";
import { transformOptions } from "@/lib/utils";

type ExpenseFormProps = {
	expenseNo: number;
	expense?: Awaited<ReturnType<typeof getExpense>>;
	isView?: boolean;
};

export function ExpenseForm({ expenseNo, expense, isView }: ExpenseFormProps) {
	const queryClient = useQueryClient();
	const {
		accounts,
		payees: loaderPayees,
		banks,
		cashEquivalentAccounts,
	} = useRouteContext({
		from: "/app/expenses",
	});
	const { data: payees } = useQuery(payeeQueries.list());

	const { mutate, isPending } = useFormUpsert({
		upsertFn: (values: ExpenseSchema) => createExpense({ data: values }),
		entityName: "Expense",
		queryKey: ["expenses"],
		navigateTo: "/app/expenses",
	});

	const expenseDetails =
		expense?.details.map(({ accountId, id, quantity, vatType, unitPrice }) => ({
			accountId: accountId.toString(),
			id,
			quantity: Number(quantity),
			unitPrice: Number(unitPrice),
			vatType,
		})) || [];

	const form = useAppForm({
		defaultValues: {
			expenseNo,
			expenseDate:
				expense?.expenseDate || new Date().toISOString().split("T")[0],
			payeeId: expense?.payeeId || "",
			paymentMethod: expense?.paymentMethod || "cash",
			reference: expense?.reference?.toUpperCase() || "",
			bankId: expense?.bankId || null,
			creditingAccountId: expense?.creditingAccountId
				? expense.creditingAccountId.toString()
				: null,
			details: expenseDetails,
			attachments:
				expense?.attachments.map(({ fileName, fileType, fileUrl }) => ({
					filename: fileName ?? "",
					mimeType: fileType ?? "",
					url: fileUrl ?? "",
				})) || [],
		} as ExpenseSchema,
		validators: {
			onSubmit: expenseSchema,
		},
		onSubmit: ({ value }) => {
			if (isView) return;
			mutate(
				{ ...value, id: expense?.id },
				{
					onSuccess: () => {
						queryClient.invalidateQueries({
							queryKey: ["expenseNo"],
						});
					},
				},
			);
		},
	});

	const formValues = useStore(form.store, (state) => state.values);
	const summary = useMemo(() => {
		return calculateExpenseRequest(formValues.details || []);
	}, [formValues.details]);

	const isBankAccount =
		formValues.paymentMethod === "bank" ||
		formValues.paymentMethod === "cheque";

	useEffect(() => {
		if (
			formValues.paymentMethod === "cash" ||
			formValues.paymentMethod === "mpesa"
		) {
			form.setFieldValue("bankId", null);
		} else if (
			formValues.paymentMethod === "bank" ||
			formValues.paymentMethod === "cheque"
		) {
			form.setFieldValue("creditingAccountId", null);
		}
	}, [formValues.paymentMethod, form]);

	return (
		<div className="space-y-6">
			<PageHeader
				title={
					!expense ? "New Expense" : isView ? "View Expense" : "Edit Expense"
				}
				description={
					!expense
						? "Add a new expense"
						: isView
							? "View expense details"
							: "Edit details of expense"
				}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					if (isView) return;
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
					<form.AppField name="expenseNo">
						{(field) => (
							<field.Input readOnly label="Expense No" disabled={isView} />
						)}
					</form.AppField>
					<form.AppField name="expenseDate">
						{(field) => (
							<field.Input
								type="date"
								label="Expense Date"
								required
								disabled={isView}
							/>
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
									disabled={isView}
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
								disabled={isView}
							>
								{PAYMENT_METHODS.map((method) => (
									<SelectItem key={method.value} value={method.value}>
										{method.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					{isBankAccount ? (
						<form.AppField name="bankId">
							{(field) => (
								<field.Select
									label="Bank"
									required
									placeholder="Select Bank"
									disabled={isView}
								>
									{banks.map((method) => (
										<SelectItem key={method.value} value={method.value}>
											{method.label}
										</SelectItem>
									))}
								</field.Select>
							)}
						</form.AppField>
					) : (
						<form.AppField name="creditingAccountId">
							{(field) => (
								<field.Select
									label="Crediting Account"
									required
									placeholder="Select Crediting Account"
									disabled={isView}
								>
									{cashEquivalentAccounts.map((method) => (
										<SelectItem key={method.value} value={method.value}>
											{method.label}
										</SelectItem>
									))}
								</field.Select>
							)}
						</form.AppField>
					)}
					<form.AppField name="reference">
						{(field) => (
							<field.Input
								label="Reference"
								placeholder="Enter Reference"
								required
								disabled={isView}
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
								{!isView && (
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
											className="bg-destructive/10 text-destructive hover:bg-destructive/40"
										>
											<MinusIcon className="size-4" aria-hidden="true" />
											Clear Lines
										</Button>
									</ButtonGroup>
								)}
							</div>
							{field.state.value.map((item, index) => {
								const lineSubTotal =
									parseFloat(item.quantity?.toString() ?? "1") *
									parseFloat(item.unitPrice?.toString() ?? "0");
								return (
									<div
										className="p-4 border rounded-md space-y-4"
										key={item.id}
									>
										<FieldGroup className="grid md:grid-cols-2 lg:grid-cols-12 gap-4">
											<div className="col-span-full lg:col-span-4">
												<form.AppField name={`details[${index}].accountId`}>
													{(field) => (
														<field.Select
															label="Account"
															required
															placeholder="Select Account"
															disabled={isView}
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
														disabled={isView}
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
															disabled={isView}
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
															disabled={isView}
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
										</FieldGroup>
										<FieldGroup className="flex flex-row! items-center justify-between">
											<div className="flex-1">
												<form.AppField name={`details[${index}].description`}>
													{(field) => (
														<field.Input
															label="Description"
															disabled={isView}
														/>
													)}
												</form.AppField>
											</div>
											{!isView && (
												<Button
													type="button"
													variant="destructive"
													onClick={() => field.removeValue(index)}
													className="self-end"
													size="icon-lg"
												>
													<TrashIcon className="size-4" aria-hidden="true" />
												</Button>
											)}
										</FieldGroup>
									</div>
								);
							})}
						</div>
					)}
				</form.Field>
				<Separator className="my-4" />
				<div className="my-4 gap-4 grid md:grid-cols-3">
					<form.Field name="attachments">
						{(field) => (
							<div className="mt-4 space-y-2 lg:col-span-2 max-w-lg">
								{!isView && (
									<FormUploader
										value={field.state.value}
										onChange={(newAttachments) =>
											field.handleChange(newAttachments)
										}
									/>
								)}
								{field.state.value?.map((attachment, index) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: <>
										key={index}
										className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm"
									>
										<div className="flex items-center gap-3">
											<div className="p-2 bg-primary/10 rounded-full">
												<span className="text-primary text-xs">📄</span>
											</div>
											<div className="flex flex-col">
												<span className="text-sm font-medium truncate max-w-[200px]">
													{attachment.filename}
												</span>
												<Button
													asChild
													variant="link"
													size="sm"
													className="justify-start"
												>
													<a
														href={attachment.url}
														target="_blank"
														rel="noopener noreferrer"
													>
														View
													</a>
												</Button>
											</div>
										</div>
										{!isView && (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => field.removeValue(index)}
												className="text-destructive hover:text-destructive/80"
											>
												<TrashIcon className="size-4" />
											</Button>
										)}
									</div>
								))}
							</div>
						)}
					</form.Field>

					<div className="bg-secondary p-4 rounded-md space-y-4">
						<h2 className="text-sm font-semibold">Expense Summary</h2>
						<div className="flex items-center justify-between">
							<div className="text-xs font-medium text-muted-foreground">
								Sub Total
							</div>
							<div className="text-xs font-medium">
								{currencyFormatter(summary.subTotal)}
							</div>
						</div>
						<div className="flex items-center justify-between">
							<div className="text-xs font-medium text-muted-foreground">
								Tax Amount
							</div>
							<div className="text-xs font-medium">
								{currencyFormatter(summary.taxAmount)}
							</div>
						</div>
						<div className="flex items-center justify-between">
							<div className="text-xs font-medium text-muted-foreground">
								Grand Total
							</div>
							<div className="text-xs font-medium">
								{currencyFormatter(summary.grandTotal)}
							</div>
						</div>
					</div>
				</div>
				{!isView && (
					<FieldGroup className="mt-4">
						<form.AppForm>
							<form.SubmitButton
								isLoading={isPending}
								buttonText={expense ? "Update Expense" : "Create Expense"}
								withReset
							/>
						</form.AppForm>
					</FieldGroup>
				)}
			</form>
		</div>
	);
}
