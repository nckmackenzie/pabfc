import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { BanIcon } from "lucide-react";
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
import {
	type RemittanceFormValues,
	remittanceFormSchema,
} from "@/features/wht-remittances/services/schemas";
import { remittanceQueries } from "@/features/wht-remittances/services/queries";
import { createRemittance } from "@/features/wht-remittances/services/wht-remittances.api";
import { toRemittanceBillRow } from "@/features/wht-remittances/utils/lib";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat, roundDecimal } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";
import type { Option } from "@/types/index.types";

type RemittanceFormProps = {
	banks: Array<Option>;
	cashEquivalentAccounts: Array<Option>;
	remittanceNo?: string;
	remittance?: RemittanceFormValues;
};

/**
 * Pays KRA the tax withheld on bills. Unlike a bill payment this is not scoped to
 * one vendor: a single remittance covers every bill in the filing period, so the
 * bill list is the full set of outstanding WHT balances rather than one vendor's.
 */
export function RemittanceForm({
	banks,
	cashEquivalentAccounts,
	remittanceNo,
	remittance,
}: RemittanceFormProps) {
	const queryClient = useQueryClient();
	const router = useRouter();

	const { isPending, mutate } = useFormUpsert({
		upsertFn: (data: RemittanceFormValues) => createRemittance({ data }),
		entityName: "WHT remittance",
		queryKey: ["wht-remittances"],
		navigateTo: "/app/wht-remittances",
		onSuccessCallback: async () => {
			// The bill list shows WHT figures, and the remittance screen reads the
			// balances this has just moved.
			queryClient.invalidateQueries({ queryKey: ["bills"] });
			if (remittance?.id) {
				queryClient.invalidateQueries({
					queryKey: ["wht-remittances", "detail", remittance.id],
				});
			}
			await router.invalidate({ sync: true });
		},
	});

	const form = useAppForm({
		defaultValues:
			remittance ??
			({
				remittanceNo: remittanceNo ?? "",
				remittanceDate: dateFormat(new Date()),
				paymentMethod: "bank",
				reference: "",
				bankId: null,
				cashEquivalentAccountId: null,
				memo: null,
				bills: [],
			} as RemittanceFormValues),
		validators: {
			onSubmit: remittanceFormSchema,
		},
		onSubmit: ({ value }) => {
			mutate({ ...value, id: remittance?.id });
		},
	});

	const [paymentMethod, bills] = useStore(form.store, (state) => [
		state.values.paymentMethod,
		state.values.bills,
	]);

	const {
		data: outstandingBills,
		isLoading,
		error,
	} = useQuery({
		...remittanceQueries.outstandingBills(),
		// An existing remittance carries its own lines; refetching would drop them.
		enabled: !remittance,
	});

	const isBankAccount = paymentMethod === "bank" || paymentMethod === "cheque";
	const noOutstandingWht = Boolean(
		!remittance && outstandingBills && outstandingBills.length === 0,
	);

	useEffect(() => {
		if (remittance || !outstandingBills) return;
		form.setFieldValue("bills", outstandingBills.map(toRemittanceBillRow));
	}, [outstandingBills, form, remittance]);

	useEffect(() => {
		if (paymentMethod === "cash" || paymentMethod === "mpesa") {
			form.setFieldValue("bankId", null);
		} else if (paymentMethod === "bank" || paymentMethod === "cheque") {
			form.setFieldValue("cashEquivalentAccountId", null);
		}
	}, [paymentMethod, form]);

	function handleRemitFullBalance() {
		form.setFieldValue(
			"bills",
			bills.map((bill) => ({
				...bill,
				amount: bill.selected ? bill.whtBalance : null,
			})),
		);
	}

	const totalToRemit = roundDecimal(
		bills.reduce(
			(acc, bill) => (bill.selected ? acc + Number(bill.amount ?? 0) : acc),
			0,
		),
	);
	const totalOutstanding = roundDecimal(
		bills.reduce((acc, bill) => acc + bill.whtBalance, 0),
	);

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
				<form.AppField name="remittanceNo">
					{(field) => <field.Input label="Remittance No" disabled />}
				</form.AppField>
				<form.AppField name="remittanceDate">
					{(field) => (
						<field.Input type="date" label="Remittance Date" required />
					)}
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
					{(field) => (
						<field.Input
							label="Reference"
							placeholder="KRA payment slip / PRN"
							required
						/>
					)}
				</form.AppField>
				{isBankAccount ? (
					<form.AppField name="bankId">
						{(field) => (
							<field.Select label="Bank" required placeholder="Select Bank">
								{banks.map((bank) => (
									<SelectItem key={bank.value} value={bank.value}>
										{bank.label}
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
								{cashEquivalentAccounts.map((account) => (
									<SelectItem key={account.value} value={account.value}>
										{account.label}
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
							placeholder="e.g. WHT for March 2026"
						/>
					)}
				</form.AppField>
			</FieldGroup>

			{noOutstandingWht && (
				<EmptyState
					icon={<BanIcon />}
					title=""
					description="No bills have withholding tax outstanding."
				/>
			)}
			{error && <AlertErrorComponent message={error.message} />}
			{isLoading && <RemittanceLinesSkeleton />}
			{bills.length > 0 && (
				<div className="border rounded-md p-4">
					<div className="flex items-center justify-between border-b pb-4">
						<div>
							<h3 className="text-base font-semibold">Outstanding WHT</h3>
							<p className="text-sm text-muted-foreground">
								Select the bills this payment covers and the amount remitted for
								each
							</p>
						</div>
						<div className="grid gap-0.5">
							<p className="text-sm text-muted-foreground font-semibold">
								Total Outstanding
							</p>
							<p className="text-sm font-semibold">
								{currencyFormatter(totalOutstanding)}
							</p>
						</div>
					</div>
					<div className="overflow-x-auto border rounded-md p-4">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead />
									<TableHead className="w-[220px]">Vendor</TableHead>
									<TableHead className="w-[150px]">PIN</TableHead>
									<TableHead className="w-[150px]">Invoice #</TableHead>
									<TableHead className="w-[140px]">Invoice Date</TableHead>
									<TableHead className="w-[150px] text-right">
										WHT Withheld
									</TableHead>
									<TableHead className="w-[150px] text-right">
										WHT Balance
									</TableHead>
									<TableHead className="w-[170px]">Amount to Remit</TableHead>
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
												<TableCell>{toTitleCase(bill.vendorName)}</TableCell>
												<TableCell>{bill.taxPin?.toUpperCase() ?? "-"}</TableCell>
												<TableCell>{bill.invoiceNo}</TableCell>
												<TableCell>
													{dateFormat(bill.invoiceDate, "reporting")}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{currencyFormatter(bill.whtAmount, false)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{currencyFormatter(bill.whtBalance, false)}
												</TableCell>
												<TableCell>
													<form.Subscribe
														selector={(state) =>
															state.values.bills[index]?.selected
														}
													>
														{(selected) =>
															selected ? (
																<form.AppField name={`bills[${index}].amount`}>
																	{(field) => (
																		<field.Input
																			label=""
																			type="number"
																			step="0.01"
																			min={0}
																			max={bill.whtBalance}
																			className="h-8"
																		/>
																	)}
																</form.AppField>
															) : (
																<Input className="h-8 border-none" disabled />
															)
														}
													</form.Subscribe>
												</TableCell>
											</TableRow>
										))
									}
								</form.AppField>
							</TableBody>
							<TableFooter>
								<TableRow className="bg-background hover:bg-background">
									<TableCell colSpan={7}>
										<div className="flex items-center gap-2">
											<Checkbox
												id="remit-full-balance"
												onCheckedChange={(checked) =>
													checked ? handleRemitFullBalance() : null
												}
											/>
											<label
												htmlFor="remit-full-balance"
												className="text-muted-foreground font-normal"
											>
												Remit the full outstanding WHT on all selected bills
											</label>
										</div>
									</TableCell>
									<TableCell className="font-semibold tabular-nums">
										{currencyFormatter(totalToRemit)}
									</TableCell>
								</TableRow>
							</TableFooter>
						</Table>
					</div>
				</div>
			)}
			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					buttonText={remittance ? "Update Remittance" : "Submit Remittance"}
					withReset
				/>
			</form.AppForm>
		</form>
	);
}

function RemittanceLinesSkeleton() {
	return (
		<div className="border rounded-md p-4 space-y-4">
			<div className="flex items-center justify-between border-b pb-4">
				<div className="space-y-2">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-4 w-72" />
				</div>
				<div className="grid gap-1">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-4 w-20" />
				</div>
			</div>
			{Array.from({ length: 4 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
				<Skeleton key={i} className="h-10 w-full" />
			))}
		</div>
	);
}

export function RemittanceFormPendingComponent() {
	return (
		<div className="space-y-6 w-full">
			<Skeleton className="h-8 w-52 bg-gray-200 dark:bg-gray-800" />
			<Wrapper size="full">
				<PageHeader
					title="New WHT Remittance"
					description="Remit withholding tax deducted on bills to KRA."
				/>
				<div className="space-y-4">
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
								key={i}
								className="grid gap-2"
							>
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-10 w-full" />
							</div>
						))}
					</div>
					<RemittanceLinesSkeleton />
				</div>
			</Wrapper>
		</div>
	);
}
