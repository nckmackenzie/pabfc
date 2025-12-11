import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { MemberAvatar } from "@/features/members/components/member-table";
import { paymentsQueries } from "@/features/payments/services/queries";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function PaymentTable() {
	const { data } = useSuspenseQuery(paymentsQueries.list());

	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "paymentDate",
			header: "Payment Date",
			cell: ({ row }) => dateFormat(row.original.paymentDate, "long"),
		},
		{
			accessorKey: "member",
			header: "Member",
			cell: ({ row }) => {
				const member = row.original.member;
				return (
					<div className="flex items-center gap-2">
						<MemberAvatar
							memberName={`${member.firstName} ${member.lastName}`}
							image={member.image}
						/>
						<span>{toTitleCase(`${member.firstName} ${member.lastName}`)}</span>
					</div>
				);
			},
		},
		{
			accessorKey: "paymentNo",
			header: "Payment No",
			cell: ({ row }) => row.original.paymentNo,
		},
		{
			accessorKey: "reference",
			header: "Reference",
			cell: ({ row }) => row.original.reference,
		},
		{
			accessorKey: "amount",
			header: "Amount",
			cell: ({ row }) => row.original.amount,
		},
	];

	return <DataTable columns={columns} data={data} />;
}
