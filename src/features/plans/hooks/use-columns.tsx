import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { MemberAvatar } from "@/features/members/components/member-table";
import type { getPlanPaymentsByDuration } from "@/features/plans/services/plans.api";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type Payment = Awaited<ReturnType<typeof getPlanPaymentsByDuration>>[number];
export function useColumns() {
	const paymentsColumns: Array<ColumnDef<Payment>> = [
		{
			accessorKey: "member",
			header: "Member",
			cell: ({
				row: {
					original: { member },
				},
			}) => (
				<div className="flex items-center gap-2">
					<MemberAvatar
						memberName={`${member.firstName} ${member.lastName}`}
						image={member.image}
					/>
					<p>
						{toTitleCase(
							`${member.firstName.toLowerCase()} ${member.lastName.toLowerCase()}`,
						)}
					</p>
				</div>
			),
		},
		{
			accessorKey: "paymentDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Payment Date" />
			),
			cell: ({
				row: {
					original: { paymentDate },
				},
			}) => dateFormat(paymentDate, "long"),
		},
		{
			accessorKey: "amount",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Amount" />
			),
			cell: ({
				row: {
					original: { amount },
				},
			}) => <Badge variant="outline">{currencyFormatter(amount)}</Badge>,
		},
		{
			accessorKey: "paymentMethod",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Payment Method" />
			),
			cell: ({
				row: {
					original: { paymentMethod },
				},
			}) => (paymentMethod ? paymentMethod : null),
		},
		{
			accessorKey: "reference",
			header: "Reference",
			cell: ({
				row: {
					original: { reference },
				},
			}) => (reference ? reference.toUpperCase() : null),
		},
	];

	return {
		paymentsColumns,
	};
}
