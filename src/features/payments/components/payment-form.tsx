import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { BanIcon, MousePointerClickIcon } from "lucide-react";
import { useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Wrapper } from "@/components/ui/wrapper";
import { billQueries } from "@/features/bills/services/queries";
import { createPayment } from "@/features/payments/services/payments.api";
import {
	type PaymentFormValues,
	paymentFormSchema,
} from "@/features/payments/services/schema";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import type { Option } from "@/types/index.types";

type PaymentFormProps = {
	vendors: Array<Option>;
	banks: Array<Option>;
	paymentNo?: string;
	cashEquivalentAccounts: Array<Option>;
	payment?: PaymentFormValues;
	billId?: string;
};

export function PaymentForm({
	vendors,
	paymentNo,
	banks,
	cashEquivalentAccounts,
	payment,
	billId,
}: PaymentFormProps) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { isPending, mutate } = useFormUpsert({
		upsertFn: (data: PaymentFormValues) => createPayment({ data }),
		entityName: "Payment",
		queryKey: ["payments"],
		navigateTo: "/app/payments",
		onSuccessCallback: async () => {
			queryClient.invalidateQueries({ queryKey: ["bills"] });
			if (payment?.id) {
				queryClient.invalidateQueries({
					queryKey: ["payments", "detail", payment.id],
				});
			}
			await router.invalidate({ sync: true });
		},
	});

	const form = useAppForm({
		defaultValues: payment
			? payment
			: ({
					vendorId: "",
					paymentNo: paymentNo ?? "",
					paymentDate: dateFormat(new Date()),
					paymentMethod: "cheque",
					reference: "",
					bankId: null,
					cashEquivalentAccountId: null,
					memo: null,
					bills: [],
				} as PaymentFormValues),
		validators: {
			onSubmit: paymentFormSchema,
		},
		onSubmit: ({ value }) => {
			mutate({ ...value, id: payment?.id });
		},
	});

	const [paymentMethod, vendorId, bills] = useStore(form.store, (state) => [
		state.values.paymentMethod,
		state.values.vendorId,
		state.values.bills,
	]);

	const { data, isLoading, refetch, error } = useQuery({
		...billQueries.pendingBillsBySupplier(vendorId),
		enabled: !!vendorId && !payment,
	});

	const vendorNotSelected = vendorId.trim().length === 0;
	const noUnpaidBills = data && !data.length;
	const isBankAccount = paymentMethod === "bank" || paymentMethod === "cheque";

	useEffect(() => {
		if (payment) return;
		if (vendorId.trim().length > 0) {
			refetch();
			form.setFieldValue(
				"bills",
				data?.map((bill) => ({
					selected: false,
					invoiceNo: bill.invoiceNo,
					invoiceDate: bill.invoiceDate,
					dueDate: bill.dueDate,
					total: parseFloat(bill.total),
					balance: parseFloat(bill.balance),
					billId: bill.id,
					amount: null,
				})) ?? [],
			);
		}
	}, [vendorId, refetch, form, data, payment]);

	useEffect(() => {
		if (!billId) return;
		queryClient.fetchQuery(billQueries.detail(billId)).then((bill) => {
			form.setFieldValue("vendorId", bill.vendorId);
			form.setFieldValue("bills", [
				{
					selected: true,
					invoiceNo: bill.invoiceNo,
					invoiceDate: bill.invoiceDate,
					dueDate: bill.dueDate,
					total: parseFloat(bill.total),
					balance: parseFloat(bill.total),
					billId: bill.id,
				},
			]);
		});
	}, [billId, form, queryClient]);

	useEffect(() => {
		if (paymentMethod === "cash" || paymentMethod === "mpesa") {
			form.setFieldValue("bankId", null);
		} else if (paymentMethod === "bank" || paymentMethod === "cheque") {
			form.setFieldValue("cashEquivalentAccountId", null);
		}
	}, [paymentMethod, form]);

	function handleAllocateFullAmount() {
		form.setFieldValue(
			"bills",
			bills.map((bill) => ({
				...bill,
				amount: bill.selected ? parseFloat(bill.balance.toString()) : null,
			})),
		);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
				<form.AppField name="paymentNo">
					{(field) => <field.Input label="Payment No" disabled />}
				</form.AppField>
				<form.AppField name="vendorId">
					{(field) => (
						<field.Combobox
							label="Supplier"
							required
							items={vendors}
							placeholder="Select Supplier"
						/>
					)}
				</form.AppField>
				<form.AppField name="paymentDate">
					{(field) => <field.Input type="date" label="Payment Date" required />}
				</form.AppField>
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
					{(field) => <field.Input label="Reference" required />}
				</form.AppField>
				{isBankAccount ? (
					<form.AppField name="bankId">
						{(field) => (
							<field.Select label="Bank" required placeholder="Select Bank">
								{banks.map((method) => (
									<SelectItem key={method.value} value={method.value}>
										{method.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
				) : (
					<form.AppField name="cashEquivalentAccountId">
						{(field) => (
							<field.Select
								label="Crediting Account"
								required
								placeholder="Select Crediting Account"
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
				<form.AppField name="memo">
					{(field) => (
						<field.Input
							label="Description"
							fieldClassName="md:col-span-3"
							placeholder="Description of payment...."
						/>
					)}
				</form.AppField>
			</FieldGroup>
			{(vendorNotSelected || noUnpaidBills) && (
				<EmptyState
					icon={vendorNotSelected ? <MousePointerClickIcon /> : <BanIcon />}
					title=""
					description={
						vendorNotSelected
							? "Select vendor to view and select bills to pay"
							: "No unpaid bills found for this vendor"
					}
				/>
			)}
			{error && <AlertErrorComponent message={error.message} />}
			{isLoading && <LoadingComponent />}
			{bills && bills.length > 0 && (
				<div className="border rounded-md p-4">
					<div className="flex items-center justify-between border-b pb-4">
						<div>
							<h3 className="text-base font-semibold">Unpaid Bills</h3>
							<p className="text-sm text-muted-foreground">
								Select which bills to pay and specify the amount for each
							</p>
						</div>
						<div className="grid gap-0.5">
							<p className="text-sm text-muted-foreground font-semibold">
								Total Amount
							</p>
							<p className="text-sm font-semibold">
								{currencyFormatter(
									bills.reduce(
										(acc, bill) => acc + parseFloat(bill.balance.toString()),
										0,
									),
								)}
							</p>
						</div>
					</div>

					<Table>
						<TableHeader>
							<TableRow>
								<TableHead></TableHead>
								<TableHead className="w-[300px]">Invoice #</TableHead>
								<TableHead className="w-[300px]">Invoice Date</TableHead>
								<TableHead className="w-[300px]">Due Date</TableHead>
								<TableHead className="w-[180px]">Invoice Amount</TableHead>
								<TableHead className="w-[180px]">Balance</TableHead>
								<TableHead className="w-[180px]">Amount to Pay</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<form.AppField name="bills" mode="array">
								{(field) =>
									field.state.value.map((bill, index) => (
										<TableRow key={bill.billId}>
											<TableCell>
												<form.AppField name={`bills[${index}].selected`}>
													{(field) => <field.Checkbox label="" />}
												</form.AppField>
											</TableCell>
											<TableCell>{bill.invoiceNo}</TableCell>
											<TableCell>
												{dateFormat(bill.invoiceDate, "reporting")}
											</TableCell>
											<TableCell>
												{bill.dueDate
													? dateFormat(bill.dueDate, "reporting")
													: ""}
											</TableCell>
											<TableCell>
												{currencyFormatter(bill.total, false)}
											</TableCell>
											<TableCell>
												{currencyFormatter(bill.balance, false)}
											</TableCell>
											<TableCell>
												{bill.selected ? (
													<form.AppField name={`bills[${index}].amount`}>
														{(field) => (
															<field.Input
																label=""
																type="number"
																min={0}
																max={bill.balance}
																className="h-8"
															/>
														)}
													</form.AppField>
												) : (
													<Input className="h-8 border-none" disabled />
												)}
											</TableCell>
										</TableRow>
									))
								}
							</form.AppField>
						</TableBody>
						<TableFooter>
							<TableRow className="bg-background hover:bg-background">
								<TableCell colSpan={6}>
									<div className="flex items-centre gap-2">
										<Checkbox
											onCheckedChange={(checked) =>
												checked ? handleAllocateFullAmount() : null
											}
										/>
										<label
											htmlFor="select-all"
											className="text-muted-foreground font-normal"
										>
											Allocate full outstanding amount to all selected bills
										</label>
									</div>
								</TableCell>

								<TableCell>
									{currencyFormatter(
										bills.reduce(
											(acc, bill) =>
												acc + parseFloat(bill.amount?.toString() ?? "0"),
											0,
										),
									)}
								</TableCell>
							</TableRow>
						</TableFooter>
					</Table>
				</div>
			)}
			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					buttonText={payment && !billId ? "Update Payment" : "Submit Payment"}
					withReset
				/>
			</form.AppForm>
		</form>
	);
}

function LoadingComponent() {
	return (
		<div className="border rounded-md p-4">
			<div className="flex items-center justify-between border-b pb-4">
				<div className="space-y-2">
					<Skeleton className="h-5 w-28" />
					<Skeleton className="h-4 w-64" />
				</div>
				<div className="grid gap-1">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-20" />
				</div>
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead />
						<TableHead className="w-[300px]">Invoice #</TableHead>
						<TableHead className="w-[300px]">Invoice Date</TableHead>
						<TableHead className="w-[300px]">Due Date</TableHead>
						<TableHead className="w-[180px]">Invoice Amount</TableHead>
						<TableHead className="w-[180px]">Balance</TableHead>
						<TableHead className="w-[180px]">Amount to Pay</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: 4 }).map((_, i) => (
						<TableRow
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
							key={i}
						>
							<TableCell>
								<Skeleton className="h-4 w-4" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-24" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-24" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-24" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-20" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-20" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-8 w-full" />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
				<TableFooter>
					<TableRow className="bg-background hover:bg-background">
						<TableCell colSpan={6}>
							<Skeleton className="h-4 w-72" />
						</TableCell>
						<TableCell>
							<Skeleton className="h-4 w-20" />
						</TableCell>
					</TableRow>
				</TableFooter>
			</Table>
		</div>
	);
}

export function PaymentFormPendingComponent() {
	return (
		<div className="space-y-6 w-full">
			<Skeleton className="h-8 w-44 bg-gray-200 dark:bg-gray-800" />
			<Wrapper size="full">
				<PageHeader
					title="New Payment"
					description="Create a new payment. All fields are required."
				/>
				<div className="space-y-4">
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Array.from({ length: 6 }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: <index is used as key>
							<FormGroupSkeleton key={i} />
						))}
					</div>
					<FormGroupSkeleton />
				</div>
				<div className="flex flex-col items-center justify-center gap-6">
					<Skeleton className="size-10" />
					<Skeleton className="w-md h-4" />
				</div>
			</Wrapper>
		</div>
	);
}

function FormGroupSkeleton() {
	return (
		<div className="grid gap-2">
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-10 w-full" />
		</div>
	);
}
