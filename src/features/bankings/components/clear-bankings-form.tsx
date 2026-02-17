import { useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import toast from "react-hot-toast";
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
import { ToastContent } from "@/components/ui/toast-content";
import {
	clearBankings,
	getUnclearedBankings,
} from "@/features/bankings/services/bankings.api";
import {
	type BulkBankClearingsFormSchema,
	bulkBankClearingsFormSchema,
	clearBankingsFilterFormSchema,
} from "@/features/bankings/services/schema";
import { MemberInfo } from "@/features/members/components/member-profile";
import { useFilters } from "@/hooks/use-filters";
import { useSheet } from "@/integrations/sheet-provider";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type Banking = Awaited<ReturnType<typeof getUnclearedBankings>>[number];

export function ClearBankingsForm() {
	const queryClient = useQueryClient();
	const { setOpen } = useSheet();
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

	const { isPending, mutate: clear } = useMutation({
		mutationFn: (data: BulkBankClearingsFormSchema) => clearBankings({ data }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["bankings", "clear"] });
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Bankings Cleared"
					message="Bankings cleared successfully"
				/>
			));
		},
		onError: (error) => {
			let message = "Failed to clear bank posting";
			if (error instanceof Error) {
				const parsed = parseErrorMessage(error);
				message = parsed.message;
			}
			toast.error((t) => (
				<ToastContent t={t} title="Error" message={message} />
			));
		},
	});

	const form = useAppForm({
		defaultValues: {
			bankId: result.data.bankId,
			bankings: [],
		} as BulkBankClearingsFormSchema,
		validators: {
			onSubmit: bulkBankClearingsFormSchema,
		},
		onSubmit: ({ value }) => {
			clear({ ...value, bankings: value.bankings.filter((b) => b.selected) });
		},
	});

	const bankings = useStore(form.store, (state) => state.values.bankings);
	const selectedBankings = bankings.filter((b) => b.selected);

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

	function handleDisplayMore(bankingId: string) {
		const banking = data?.find((b) => b.id === bankingId);
		if (!banking) return;
		setOpen(<ShowMore banking={banking} />, {
			side: "right",
			title: "Banking Details",
			description: "View banking details",
		});
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<div className="overflow-x-auto border rounded-md p-4">
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
										<TableCell
											title="Click to view more"
											className="font-semibold text-blue-500 hover:text-blue-600 hover:underline transition-all cursor-pointer"
											onClick={() => handleDisplayMore(banking.bankingId)}
										>
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
			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					withReset={false}
					disabled={selectedBankings.length === 0}
					buttonText={`Clear ${selectedBankings.length === 0 ? "" : selectedBankings.length} ${selectedBankings.length === 1 ? "Banking" : "Bankings"}`}
				/>
			</form.AppForm>
		</form>
	);
}

function ShowMore({ banking }: { banking: Banking }) {
	return (
		<div className="p-4 grid md:grid-cols-2 gap-4">
			<MemberInfo
				label="Transaction Date"
				value={dateFormat(banking.transactionDate, "reporting")}
			/>
			<MemberInfo
				label="Post Date"
				value={dateFormat(banking.createdAt, "reporting")}
			/>
			<MemberInfo
				label="Amount"
				value={currencyFormatter(banking.amount, false)}
			/>
			<MemberInfo label="Reference" value={banking.reference.toUpperCase()} />
			<MemberInfo
				label="Direction"
				value={banking.dc === "credit" ? "Money Out" : "Money In"}
			/>
			<MemberInfo
				label="Source"
				value={
					banking.source
						? banking.source === "posting"
							? "Bank Posting"
							: toTitleCase(banking.source)
						: "Unknown"
				}
			/>
			<MemberInfo
				className="col-span-2"
				label="Narration"
				value={banking.narration ? toTitleCase(banking.narration) : "N/A"}
			/>
		</div>
	);
}
