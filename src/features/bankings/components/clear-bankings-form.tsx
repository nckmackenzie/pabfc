import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { Input } from "@/components/ui/input";
import { DatatableSkeleton } from "@/components/ui/loaders";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { getUnclearedBankings } from "@/features/bankings/services/bankings.api";
import {
	type BulkBankClearingsFormSchema,
	bulkBankClearingsFormSchema,
	clearBankingsFilterFormSchema,
} from "@/features/bankings/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

export function ClearBankingsForm() {
	const { filters } = useFilters(getRouteApi("/app/bankings/clear").id);
	const result = clearBankingsFilterFormSchema.safeParse(filters);
	if (!result.success) {
		throw new Error("Invalid filters provided");
	}
	const { data, isLoading, error } = useQuery({
		queryKey: ["bankings", "clear", result.data],
		queryFn: () => getUnclearedBankings({ data: result.data }),
		enabled: !!result.success,
	});

	const form = useAppForm({
		defaultValues: {
			bankId: result.data.bankId,
			bankings: [],
		} as BulkBankClearingsFormSchema,
		validators: {
			onSubmit: bulkBankClearingsFormSchema,
		},
		onSubmit: ({ value }) => {},
	});

	useEffect(() => {
		if (data) {
			form.setFieldValue(
				"bankings",
				data.map((banking) => ({
					selected: false,
					bankingId: banking.id,
					transactionDate: banking.transactionDate,
					amount: parseFloat(banking.amount),
					reference: banking.reference,
					direction: banking.dc,
					clearedAt: null,
				})),
			);
		}
	}, [data, form]);

	if (isLoading) return <DatatableSkeleton />;
	if (error) return <AlertErrorComponent message={error.message} />;
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead></TableHead>
							<TableHead className="w-[300px]">Date</TableHead>
							<TableHead className="w-[180px]">Amount</TableHead>
							<TableHead className="w-[300px]">Reference</TableHead>
							<TableHead className="w-[180px]">Direction</TableHead>
							<TableHead className="w-[300px]">Clear Date</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<form.AppField name="bankings" mode="array">
							{(field) =>
								field.state.value.map((banking, index) => (
									<TableRow key={banking.bankingId}>
										<TableCell>
											<form.AppField name={`bankings[${index}].selected`}>
												{(field) => <field.Checkbox label="" />}
											</form.AppField>
										</TableCell>
										<TableCell>
											{dateFormat(banking.transactionDate, "reporting")}
										</TableCell>
										<TableCell>
											{currencyFormatter(banking.amount, false)}
										</TableCell>
										<TableCell>{banking.reference.toUpperCase()}</TableCell>
										<TableCell>
											{banking.direction === "credit"
												? "Money Out"
												: "Money In"}
										</TableCell>
										<TableCell>
											{banking.selected ? (
												<form.AppField name={`bankings[${index}].clearedAt`}>
													{(field) => (
														<field.Input label="" type="date" className="h-8" />
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
				</Table>
			</div>
		</form>
	);
}
