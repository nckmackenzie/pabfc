import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useEffect } from "react";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
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
import { WHT_CATEGORIES } from "@/drizzle/schema";
import { correctionQueries } from "@/features/wht-corrections/services/queries";
import { createCorrection } from "@/features/wht-corrections/services/wht-corrections.api";
import {
	type CorrectionFormValues,
	correctionFormSchema,
} from "@/features/wht-corrections/services/schemas";
import { newCorrectionLine, toBillComboboxItem } from "@/features/wht-corrections/utils/lib";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";
import { PAYMENT_METHODS } from "@/lib/constants";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";
import type { Option } from "@/types/index.types";

type CorrectionFormProps = {
	banks: Array<Option>;
	cashEquivalentAccounts: Array<Option>;
	correctionNo?: string;
};

const CATEGORY_LABEL = (category: (typeof WHT_CATEGORIES)[number]) =>
	toTitleCase(category.replaceAll("_", " "));

export function CorrectionForm({
	banks,
	cashEquivalentAccounts,
	correctionNo,
}: CorrectionFormProps) {
	const queryClient = useQueryClient();
	const router = useRouter();

	const { isPending, mutate } = useFormUpsert({
		upsertFn: (data: CorrectionFormValues) => createCorrection({ data }),
		entityName: "WHT correction",
		queryKey: ["wht-corrections"],
		navigateTo: "/app/wht-corrections",
		onSuccessCallback: async () => {
			// A correction retroactively changes both the bill list (net_payable)
			// and the WHT remittance picker (wht_balance).
			queryClient.invalidateQueries({ queryKey: ["bills"] });
			queryClient.invalidateQueries({ queryKey: ["wht-remittances"] });
			await router.invalidate({ sync: true });
		},
	});

	const form = useAppForm({
		defaultValues: {
			correctionNo: correctionNo ?? "",
			correctionDate: dateFormat(new Date()),
			remittanceStatus: "pending",
			remittanceDate: null,
			paymentMethod: null,
			bankId: null,
			cashEquivalentAccountId: null,
			memo: null,
			lines: [],
		} as CorrectionFormValues,
		validators: {
			onSubmit: correctionFormSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value);
		},
	});

	const [remittanceStatus, paymentMethod, lines] = useStore(form.store, (state) => [
		state.values.remittanceStatus,
		state.values.paymentMethod,
		state.values.lines,
	]);

	const { data: correctableBills, error: billsError } = useQuery(
		correctionQueries.correctableBills(),
	);
	const billItems = (correctableBills ?? []).map(toBillComboboxItem);

	const billIds = lines.map((line) => line.billId).filter(Boolean);
	const { data: existingCorrections } = useQuery(
		correctionQueries.existingCorrectionsForBills(billIds),
	);
	const duplicateBillIds = new Set(
		(existingCorrections ?? []).map((row) => row.billId),
	);

	const isBankAccount = paymentMethod === "bank" || paymentMethod === "cheque";
	const isAlreadyRemitted = remittanceStatus === "already_remitted";

	useEffect(() => {
		if (paymentMethod === "cash" || paymentMethod === "mpesa") {
			form.setFieldValue("bankId", null);
		} else if (paymentMethod === "bank" || paymentMethod === "cheque") {
			form.setFieldValue("cashEquivalentAccountId", null);
		}
	}, [paymentMethod, form]);

	function invoiceNoFor(billId: string) {
		return correctableBills?.find((bill) => bill.id === billId)?.invoiceNo ?? billId;
	}

	const total = lines.reduce((acc, line) => acc + Number(line.amount || 0), 0);

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
				<form.AppField name="correctionNo">
					{(field) => <field.Input label="Correction No" disabled />}
				</form.AppField>
				<form.AppField name="correctionDate">
					{(field) => (
						<field.Input type="date" label="Correction Date" required />
					)}
				</form.AppField>
				<form.AppField name="remittanceStatus">
					{(field) => (
						<field.Select label="Status" required placeholder="Select Status">
							<SelectItem value="pending">Not yet remitted</SelectItem>
							<SelectItem value="already_remitted">
								Already remitted to KRA
							</SelectItem>
						</field.Select>
					)}
				</form.AppField>
				{isAlreadyRemitted && (
					<>
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
					</>
				)}
				<form.AppField name="memo">
					{(field) => (
						<field.Input
							label="Description"
							fieldClassName="md:col-span-3"
							placeholder="e.g. Missed WHT on rent bills, backlog through Aug 2026"
						/>
					)}
				</form.AppField>
			</FieldGroup>

			{billsError && <AlertErrorComponent message={billsError.message} />}
			{duplicateBillIds.size > 0 && (
				<Alert variant="warning">
					<AlertTitle>Bill already has a correction</AlertTitle>
					<AlertDescription>
						{lines
							.filter((line) => duplicateBillIds.has(line.billId))
							.map((line) => invoiceNoFor(line.billId))
							.join(", ")}{" "}
						already appear on another correction. Check you are not entering
						the same catch-up twice.
					</AlertDescription>
				</Alert>
			)}

			<form.Field name="lines" mode="array">
				{(field) => (
					<div className="space-y-4">
						<div className="flex items-center justify-end">
							<Button
								type="button"
								variant="secondary"
								onClick={() => field.pushValue(newCorrectionLine())}
							>
								<PlusIcon className="size-4" aria-hidden="true" />
								Add Line
							</Button>
						</div>
						<FieldError errors={field.state.meta.errors} />
						<div className="overflow-x-auto border rounded-md p-4">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[260px]">Bill</TableHead>
										<TableHead className="w-[220px]">Category</TableHead>
										<TableHead className="w-[110px]">Rate %</TableHead>
										<TableHead className="w-[150px]">Amount</TableHead>
										<TableHead className="w-16" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{field.state.value.map((_line, index) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: lines have no stable id
										<TableRow key={index}>
											<TableCell>
												<form.AppField name={`lines[${index}].billId`}>
													{(billField) => (
														<billField.Combobox
															label=""
															placeholder="Search bill"
															items={billItems}
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`lines[${index}].whtCategory`}>
													{(field) => (
														<field.Select label="" placeholder="Select Category">
															{WHT_CATEGORIES.map((category) => (
																<SelectItem key={category} value={category}>
																	{CATEGORY_LABEL(category)}
																</SelectItem>
															))}
														</field.Select>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`lines[${index}].whtRate`}>
													{(field) => (
														<field.Input
															label=""
															type="number"
															step="0.01"
															min={0}
															className="h-8"
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`lines[${index}].amount`}>
													{(field) => (
														<field.Input
															label=""
															type="number"
															step="0.01"
															min={0}
															className="h-8"
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<Button
													type="button"
													variant="ghost"
													onClick={() => field.removeValue(index)}
												>
													<TrashIcon className="size-4 text-destructive" aria-hidden="true" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
								{lines.length > 0 && (
									<TableFooter>
										<TableRow className="bg-background hover:bg-background">
											<TableCell colSpan={3} className="text-right font-semibold">
												Total
											</TableCell>
											<TableCell className="font-semibold tabular-nums">
												{currencyFormatter(total)}
											</TableCell>
											<TableCell />
										</TableRow>
									</TableFooter>
								)}
							</Table>
						</div>
					</div>
				)}
			</form.Field>

			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					buttonText="Submit Correction"
					withReset
				/>
			</form.AppForm>
		</form>
	);
}

export function CorrectionFormPendingComponent() {
	return (
		<div className="space-y-6 w-full">
			<Skeleton className="h-8 w-52 bg-gray-200 dark:bg-gray-800" />
			<Wrapper size="full">
				<PageHeader
					title="New WHT Correction"
					description="Record a missed withholding tax catch-up against one or more posted bills."
				/>
				<div className="space-y-4">
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Array.from({ length: 4 }).map((_, i) => (
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
					<Skeleton className="h-40 w-full" />
				</div>
			</Wrapper>
		</div>
	);
}
