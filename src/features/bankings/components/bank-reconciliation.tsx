/** biome-ignore-all lint/style/noNonNullAssertion: <> */
import { useStore } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouteContext } from "@tanstack/react-router";
import type { z } from "zod";
import { EmptyState } from "@/components/ui/empty";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { UnclearedTransactionByType } from "@/features/bankings/components/uncleared-transaction-by-type";
import { bankPostingQueries } from "@/features/bankings/services/queries";
import { bankReconciliationFormSchema } from "@/features/bankings/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useSheet } from "@/integrations/sheet-provider";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { cn, toTitleCase } from "@/lib/utils";

export function BankReconcilliation() {
	const { filters, resetFilters, setFilters } = useFilters(
		getRouteApi("/app/bankings/reconcilliation").id,
	);
	const banks = useRouteContext({
		from: "/app/bankings",
		select: (data) =>
			data.banks.map((bank) => ({
				value: bank.id,
				label: toTitleCase(bank.bankName),
			})),
	});

	const form = useAppForm({
		defaultValues: {
			bankId: filters.bankId || "",
			dateRange: {
				from: filters.from ? new Date(filters.from) : new Date(),
				to: filters.to ? new Date(filters.to) : new Date(),
			},
			bankBalance: filters.bankBalance || 0,
		} as z.infer<typeof bankReconciliationFormSchema>,
		validators: {
			onSubmit: bankReconciliationFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters({
				bankId: value.bankId,
				from: value.dateRange.from ? dateFormat(value.dateRange.from) : "",
				to: value.dateRange.to ? dateFormat(value.dateRange.to) : "",
				bankBalance: value.bankBalance,
			});
		},
	});

	const parsedFilters = bankReconciliationFormSchema.safeParse({
		...filters,
		dateRange: {
			from: filters.from ? new Date(filters.from) : undefined,
			to: filters.to ? new Date(filters.to) : undefined,
		},
	});

	function handleReset() {
		resetFilters();
		form.reset();
	}

	const errors = useStore(form.store, (state) => state.errors);

	return (
		<div className="space-y-6">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
			>
				<form.AppField name="bankId">
					{(field) => (
						<field.Select label="Bank">
							{banks.map((bank) => (
								<SelectItem key={bank.value} value={bank.value}>
									{bank.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="dateRange">
					{(field) => <field.DateRangePicker label="Date Range" />}
				</form.AppField>
				<form.AppField name="bankBalance">
					{(field) => <field.Input type="number" label="Bank Balance" />}
				</form.AppField>
				<form.AppForm>
					<form.SubmitButton
						fieldClassName={cn({
							"md:self-end": !errors.length,
							"md:self-center": errors.length > 0,
						})}
						buttonText="Submit"
						cancelButtonText="Clear"
						onReset={handleReset}
					/>
				</form.AppForm>
			</form>
			{(!filters.bankId || !filters.from || !filters.to) && (
				<EmptyState description="Please select a bank and a date range to view bank reconciliation" />
			)}
			{parsedFilters.success && (
				<ErrorBoundaryWithSuspense loader={<BankReconciliationSkeleton />}>
					<ReconciliationReport filters={parsedFilters.data} />
				</ErrorBoundaryWithSuspense>
			)}
		</div>
	);
}

function ReconciliationReport({
	filters,
}: {
	filters: z.infer<typeof bankReconciliationFormSchema>;
}) {
	const {
		data: { unclearedWithdrawals, unclearedDeposits, ...rest },
	} = useSuspenseQuery(bankPostingQueries.recon(filters));
	const nilDeposits = Number(unclearedDeposits) === 0;
	const nilWithdrawals = Number(unclearedWithdrawals) === 0;
	const { setOpen } = useSheet();

	function handleDrillDown({
		type,
		isNill,
	}: {
		type: "deposit" | "withdrawal";
		isNill: boolean;
	}) {
		if (isNill) return;
		setOpen(<UnclearedTransactionByType filters={filters} type={type} />, {
			className: "max-w-4xl!",
			title: `Uncleared ${type}s`,
			description: `Showing all uncleared ${type}s from ${dateFormat(filters.dateRange.from, "reporting")} to ${dateFormat(filters.dateRange.to, "reporting")}`,
		});
	}

	return (
		<div className="overflow-x-auto rounded-md border p-4">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Description</TableHead>
						<TableHead className="w-[300px] text-right">Amount</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell>Cash Book Balance</TableCell>
						<TableCell className="text-right font-semibold">
							{currencyFormatter(rest.cashBookBalance, false, false, true)}
						</TableCell>
					</TableRow>
					<TableRow>
						<TableCell>Uncleared Deposits</TableCell>
						<TableCell
							className={cn("text-right font-semibold", {
								"text-blue-600 transition-all hover:underline cursor-pointer hover:text-blue-800":
									!nilDeposits,
							})}
							onClick={() =>
								handleDrillDown({ type: "deposit", isNill: nilDeposits })
							}
						>
							{currencyFormatter(unclearedDeposits, false, false, true)}
						</TableCell>
					</TableRow>
					<TableRow>
						<TableCell>Uncleared Withdrawals</TableCell>
						<TableCell
							className={cn("text-right font-semibold", {
								"text-blue-600 transition-all hover:underline cursor-pointer hover:text-blue-800":
									!nilWithdrawals,
							})}
							onClick={() =>
								handleDrillDown({ type: "withdrawal", isNill: nilWithdrawals })
							}
						>
							{currencyFormatter(unclearedWithdrawals, false, false, true)}
						</TableCell>
					</TableRow>
					<TableRow>
						<TableCell>Expected Balance</TableCell>
						<TableCell className="text-right font-semibold">
							{currencyFormatter(rest.expectedBalance, false, false, true)}
						</TableCell>
					</TableRow>
					<TableRow>
						<TableCell>Actual Bank Balance</TableCell>
						<TableCell className="text-right font-semibold">
							{currencyFormatter(rest.actualBankBalance, false, false, true)}
						</TableCell>
					</TableRow>
					<TableRow>
						<TableCell>Variance</TableCell>
						<TableCell className={cn("text-right font-semibold")}>
							{currencyFormatter(rest.variance, false, false, true)}
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	);
}

function BankReconciliationSkeleton() {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Description</TableHead>
					<TableHead className="w-[300px] text-right">Amount</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell>Cash Book Balance</TableCell>
					<TableCell className="text-right">
						<Skeleton className="w-[100px] h-4 ml-auto" />
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>Uncleared Deposits</TableCell>
					<TableCell className="text-right">
						<Skeleton className="w-[100px] h-4 ml-auto" />
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>Uncleared Withdrawals</TableCell>
					<TableCell className="text-right">
						<Skeleton className="w-[100px] h-4 ml-auto" />
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>Expected Balance</TableCell>
					<TableCell className="text-right">
						<Skeleton className="w-[100px] h-4 ml-auto" />
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>Actual Bank Balance</TableCell>
					<TableCell className="text-right">
						<Skeleton className="w-[100px] h-4 ml-auto" />
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>Variance</TableCell>
					<TableCell className="text-right">
						<Skeleton className="w-[100px] h-4 ml-auto" />
					</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	);
}
