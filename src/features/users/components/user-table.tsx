import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { EditAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ResetIcon } from "@/components/ui/icons";
import {
	deleteUser,
	type UserWithLoginAttempts,
} from "@/features/users/services/users.api";
import { useFilters } from "@/hooks/use-filters";
import { useSession } from "@/lib/auth/client";
import { toTitleCase } from "@/lib/utils";
import { usersQueries } from "../services/queries";

export function UsersTable() {
	const { filters } = useFilters(getRouteApi("/app/users/").id);
	const { data } = useSuspenseQuery(usersQueries.list(filters));
	const { data: session } = useSession();
	const columns: Array<ColumnDef<UserWithLoginAttempts>> = [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Name" />
			),
			cell: ({ row }) => (
				<div className="row-font flex items-center gap-2">
					{toTitleCase(row.original.name)}
					{session?.user.id === row.original.id && (
						<Badge variant="secondary">You</Badge>
					)}
				</div>
			),
		},
		{
			accessorKey: "contact",
			header: "Contact",
		},
		{
			accessorKey: "role",
			header: "User Type",
			cell: ({ row }) => (
				<div
					className={clsx("row-font capitalize", {
						"text-success-foreground font-semibold":
							row.original.role === "admin",
					})}
				>
					{row.original.role}
				</div>
			),
		},
		{
			accessorKey: "active",
			header: "Status",
			cell: ({ row }) => {
				const status = row.original.active ? "active" : "inactive";
				return (
					<Badge
						variant={status === "active" ? "success" : "destructive"}
						className="uppercase"
					>
						{status}
					</Badge>
				);
			},
		},
		{
			accessorKey: "lastSignedInAt",
			header: "Last Signed In",
			cell: ({
				row: {
					original: { lastSignedInAt },
				},
			}) =>
				!lastSignedInAt ? (
					<Badge variant="outline">Never</Badge>
				) : (
					<Badge variant="secondary">
						{formatDistanceToNow(new Date(lastSignedInAt), { addSuffix: true })}
					</Badge>
				),
		},
		{
			id: "actions",
			cell: ({
				row: {
					original: { id },
				},
			}) =>
				id !== session?.user.id ? (
					<DatatableActions>
						<DropdownMenuItem asChild>
							<Link to="/app/users/$userId/edit" params={{ userId: id }}>
								<EditAction />
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to="/app/users/$userId/reset" params={{ userId: id }}>
								<ResetIcon className="size-4! text-muted-foreground" />
								<span className="text-xs -ml-1">Reset Password</span>
							</Link>
						</DropdownMenuItem>
						<DeleteActionButton
							resourceId={id}
							deleteAction={deleteUser}
							queryKey={["users"]}
							successMessage="User deleted successfully!"
							fallbackMessage="Error deleting user"
						/>
					</DatatableActions>
				) : null,
		},
	];
	return <DataTable data={data} columns={columns} />;
}
