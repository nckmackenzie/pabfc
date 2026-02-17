import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckIcon, ReceiptIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { CheckButton, EditAction } from "@/components/ui/custom-button";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import CustomModal from "@/components/ui/custom-modal";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastContent } from "@/components/ui/toast-content";
import {
	clearBankPosting,
	deleteBankPosting,
	type getBankPostings,
} from "@/features/bankings/services/bankings.api";
import { bankPostingQueries } from "@/features/bankings/services/queries";
import {
	type BankPostingClearenceFormSchema,
	bankPostingClearenceFormSchema,
} from "@/features/bankings/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useModal } from "@/integrations/modal-provider";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type BankPosting = Awaited<ReturnType<typeof getBankPostings>>[number];

export const BankingsDataTable = () => {
	const { filters } = useFilters(getRouteApi("/app/bankings/postings/").id);
	const { data: bankings } = useSuspenseQuery(bankPostingQueries.list(filters));

	const { setOpen } = useModal();

	function handleClear({ posting }: { posting: BankPosting }) {
		setOpen(
			<CustomModal title="Clear Bank Posting">
				<ClearForm posting={posting} />
			</CustomModal>,
		);
	}

	const columns: Array<ColumnDef<BankPosting>> = [
		{
			accessorKey: "transactionDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Date" />
			),
			cell: ({ row }) => dateFormat(row.original.transactionDate, "long"),
		},
		{
			accessorKey: "bankName",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Bank" />
			),
			cell: ({ row }) => toTitleCase(row.original.bankName),
		},
		{
			accessorKey: "direction",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Direction" />
			),
		},
		{
			accessorKey: "amount",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Amount" />
			),
			cell: ({ row }) => currencyFormatter(row.original.amount),
		},
		{
			accessorKey: "reference",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Reference" />
			),
			cell: ({ row }) => row.original.reference.toUpperCase(),
		},
		{
			accessorKey: "cleared",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Status" />
			),
			cell: ({ row }) => {
				const { cleared } = row.original;
				return (
					<Badge variant={cleared ? "success" : "danger"}>
						{cleared ? <CheckIcon /> : <XIcon />}
						{cleared ? "Cleared" : "Not Cleared"}
					</Badge>
				);
			},
		},
		{
			id: "actions",
			cell: ({ row }) =>
				!row.original.cleared ? (
					<DropdownMenu>
						<CustomDropdownTrigger />
						<CustomDropdownContent>
							<PermissionGate
								permission="banking:update"
								loadingComponent={<Skeleton className="h-4 w-56" />}
							>
								<DropdownMenuItem asChild>
									<Link
										to="/app/bankings/postings/$postingId/edit"
										params={{ postingId: row.original.id }}
									>
										<EditAction />
									</Link>
								</DropdownMenuItem>
							</PermissionGate>
							<PermissionGate permission="banking:clear">
								<DropdownMenuItem
									onClick={() => handleClear({ posting: row.original })}
								>
									<CheckButton text="Clear" />
								</DropdownMenuItem>
							</PermissionGate>
							<PermissionGate
								permission="banking:delete"
								loadingComponent={<Skeleton className="h-4 w-56" />}
							>
								<DeleteActionButton
									resourceId={row.original.id}
									queryKey={["bankings"]}
									deleteAction={deleteBankPosting}
								/>
							</PermissionGate>
						</CustomDropdownContent>
					</DropdownMenu>
				) : null,
		},
	];

	if (bankings.length === 0 && !filters.q) {
		return (
			<EmptyState
				title="No Bank Postings"
				buttonName="Create Posting"
				path="/app/bankings/postings/new"
				description="No bank postings have been recorded yet."
				icon={<ReceiptIcon />}
			/>
		);
	}

	return <DataTable data={bankings} columns={columns} />;
};

function ClearForm({ posting }: { posting: BankPosting }) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();

	const { mutate, isPending } = useMutation({
		mutationFn: (data: BankPostingClearenceFormSchema) =>
			clearBankPosting({ data }),
	});

	const form = useAppForm({
		defaultValues: {
			bankingId: posting.id,
			clearedAt: dateFormat(new Date()),
		},
		validators: {
			onSubmit: bankPostingClearenceFormSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value, {
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: ["bankings"],
					});
					handleReset();
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
		},
	});

	function handleReset() {
		form.reset();
		setClose();
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
			<FieldGroup className="grid md:grid-cols-2 gap-4">
				<Field>
					<FieldLabel>Date</FieldLabel>
					<Input
						readOnly
						value={dateFormat(posting.transactionDate, "reporting")}
					/>
				</Field>
				<Field>
					<FieldLabel>Amount</FieldLabel>
					<Input readOnly value={currencyFormatter(posting.amount)} />
				</Field>
				<Field className="col-span-2">
					<FieldLabel>Bank</FieldLabel>
					<Input readOnly value={posting.bankName} />
				</Field>
				<Field>
					<FieldLabel>Direction</FieldLabel>
					<Input readOnly value={posting.direction} />
				</Field>
				<Field>
					<FieldLabel>Reference</FieldLabel>
					<Input readOnly value={posting.reference} />
				</Field>
				<form.AppField name="clearedAt">
					{(field) => (
						<field.Input
							fieldClassName="col-span-2"
							type="date"
							label="Cleared On"
							required
						/>
					)}
				</form.AppField>
			</FieldGroup>
			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					withReset
					buttonText="Clear"
					onReset={handleReset}
				/>
			</form.AppForm>
		</form>
	);
}
