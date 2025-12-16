import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { useMemo } from "react";
import Dropzone, { type DropzoneState } from "shadcn-dropzone";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AddPayee } from "@/features/expenses/components/add-payee";
import { createExpense } from "@/features/expenses/services/expenses.api";
import { payeeQueries } from "@/features/expenses/services/queries";
import {
	type ExpenseSchema,
	expenseSchema,
} from "@/features/expenses/services/schemas";
import { calculateExpenseRequest } from "@/features/expenses/utils";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useAppForm } from "@/lib/form";
import { currencyFormatter } from "@/lib/helpers";
import { transformOptions } from "@/lib/utils";

type ExpenseFormProps = {
	expenseNo: number;
};

export function ExpenseForm({ expenseNo }: ExpenseFormProps) {
	const queryClient = useQueryClient();
	const { accounts, payees: loaderPayees } = useRouteContext({
		from: "/app/expenses",
	});
	const { data: payees } = useQuery(payeeQueries.list());

	const { mutate, isPending } = useFormMutation({
		createFn: (values: ExpenseSchema) => createExpense({ data: values }),
		entityName: "Expense",
		queryKey: ["expenses"],
		navigateTo: "/app/expenses",
	});

	const form = useAppForm({
		defaultValues: {
			expenseNo,
			expenseDate: new Date().toISOString().split("T")[0],
			payeeId: "",
			paymentMethod: "cash",
			reference: "",
			details: [],
			attachments: [],
		} as ExpenseSchema,
		validators: {
			onSubmit: expenseSchema,
		},
		onSubmit: ({ value }) => {
			mutate(
				{ data: value },
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
										className="bg-destructive/10 text-destructive hover:bg-destructive/40"
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
				<Separator className="my-4" />
				<div className="my-4 grid md:grid-cols-3 gap-4">
					<form.AppField name="attachments" mode="array">
						{(field) => (
							<div className="lg:col-span-2 max-w-lg">
								<h2 className="text-sm font-semibold">Attachments</h2>
								<Dropzone
									onDrop={(acceptedFiles: File[]) => {
										if (acceptedFiles.length > 0) {
											field.pushValue(acceptedFiles[0]);
										}
									}}
									containerClassName="p-4 border border-dashed rounded-md hover:border-primary transition-colors hover:bg-transparent!"
									dropZoneClassName="hover:bg-transparent!"
								>
									{(dropzone: DropzoneState) => (
										<div>
											{dropzone.isDragAccept ? (
												<div className="text-sm font-medium">
													Drop your files here!
												</div>
											) : (
												<div className="flex items-center flex-col gap-1.5">
													<div className="flex items-center flex-row gap-0.5 text-sm font-medium">
														Upload files
													</div>
												</div>
											)}
											<div className="text-xs text-gray-400 font-medium">
												{field.state.value?.length === 0
													? "No files uploaded"
													: field.state.value?.length === 1
														? "1 file uploaded"
														: `${field.state.value?.length} files uploaded`}
											</div>
										</div>
									)}
								</Dropzone>
								<div className="mt-4 space-y-2">
									{field.state.value?.map(
										(file: File | string, index: number) => {
											// Handle case where it might be a string (URL) vs File object
											const isFile = file instanceof File;
											const fileName = isFile
												? file.name
												: String(file).split("/").pop();
											const fileSize = isFile
												? `${(file.size / 1024).toFixed(1)} KB`
												: "";
											return (
												<div
													// biome-ignore lint/suspicious/noArrayIndexKey: <>
													key={index}
													className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm"
												>
													<div className="flex items-center gap-3">
														<div className="p-2 bg-primary/10 rounded-full">
															{/* Icon placeholder */}
															<span className="text-primary text-xs">📄</span>
														</div>
														<div className="flex flex-col">
															<span className="text-sm font-medium truncate max-w-[200px]">
																{fileName}
															</span>
															{isFile && (
																<span className="text-xs text-muted-foreground">
																	{fileSize}
																</span>
															)}
														</div>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => field.removeValue(index)}
														className="text-destructive hover:text-destructive/80"
													>
														<TrashIcon className="size-4" />
													</Button>
												</div>
											);
										},
									)}
								</div>
							</div>
						)}
					</form.AppField>

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
