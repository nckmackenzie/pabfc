import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { DeleteAction, EditAction } from "@/components/ui/custom-button";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { rolesQueries } from "@/features/users/services/queries";
import type { Role } from "@/features/users/services/roles.api";
import { deleteRole } from "@/features/users/services/roles.api";
import { useFilters } from "@/hooks/use-filters";
import { handleClientError } from "@/lib/error-handling/error-handling";
import { toTitleCase } from "@/lib/utils";

export function RolesTable() {
	const { filters } = useFilters(getRouteApi("/app/users/roles/").id);
	const { data: roles } = useSuspenseQuery(rolesQueries.list(filters.q));
	const queryClient = useQueryClient();
	const handleDelete = async (roleId: string) => {
		try {
			await deleteRole({ data: roleId });
			queryClient.invalidateQueries({ queryKey: ["roles"] });
			return { error: false, message: "Role deleted successfully!" };
		} catch (error) {
			const errorMessage = handleClientError(error, {
				fallbackMessage: "Error deleting role",
			});
			return { error: true, message: errorMessage };
		}
	};
	const columns: Array<ColumnDef<Role>> = [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Name" />
			),
			cell: ({ row }) => (
				<div className="row-font">{toTitleCase(row.original.name)}</div>
			),
		},
		{
			accessorKey: "usersAssigned",
			header: "Status",
			cell: ({
				row: {
					original: { usersAssigned },
				},
			}) => (
				<Badge variant={usersAssigned > 0 ? "success" : "outline"}>
					{usersAssigned > 0
						? `${usersAssigned} user(s) assigned`
						: "No users assigned"}
				</Badge>
			),
		},

		{
			id: "actions",
			size: 120,
			cell: ({
				row: {
					original: { id },
				},
			}) => (
				<div className="flex justify-end">
					<DropdownMenu>
						<CustomDropdownTrigger />
						<CustomDropdownContent>
							<DropdownMenuItem asChild>
								<Link
									to="/app/users/roles/$roleId/edit"
									params={{ roleId: id }}
								>
									<EditAction />
								</Link>
							</DropdownMenuItem>
							<ActionButton
								variant="ghost"
								action={handleDelete.bind(null, id)}
								requireAreYouSure
								className="px-1.5 py-1.5 justify-start h-auto w-full flex transition-colors hover:bg-destructive/20! focus:outline-0"
							>
								<DeleteAction />
							</ActionButton>
						</CustomDropdownContent>
					</DropdownMenu>
				</div>
			),
		},
	];
	return <DataTable data={roles} columns={columns} />;
}
