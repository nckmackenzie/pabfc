import { lazy } from "react";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/page-header";
import { ToastContent } from "@/components/ui/toast-content";
import type { roles } from "@/drizzle/schema";
import type { Permission } from "@/features/users/services/roles.api";
import { createRole, updateRole } from "@/features/users/services/roles.api";
import type { RoleFormValues } from "@/features/users/services/schema";
import { roleFormSchema } from "@/features/users/services/schema";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

const PermissionMatrix = lazy(() =>
	import("./permission-matrix").then((m) => ({ default: m.PermissionMatrix })),
);

type Props = {
	permissions: Array<Permission>;
	role?: Omit<typeof roles.$inferSelect, "updatedAt" | "isSystem"> & {
		permissions: Array<string>;
	};
};

export function RoleForm({ permissions, role }: Props) {
	const form = useAppForm({
		defaultValues:
			role ??
			({
				name: "",
				description: "",
				permissions: [],
			} as RoleFormValues),
		validators: {
			onSubmit: roleFormSchema,
		},
		onSubmit: ({ value }) => {
			if (value.permissions.length === 0) {
				return toast.error((t) => (
					<ToastContent
						title="No permissions selected"
						t={t}
						message="Please select at least one permission for the role."
					/>
				));
			}
			roleMutation.mutate({ data: value, id: role?.id });
		},
	});

	const roleMutation = useFormMutation({
		createFn: (data: RoleFormValues) => createRole({ data }),
		updateFn: async (id: string, data: RoleFormValues) => {
			await updateRole({ data: { roleId: id, values: data } });
			return id;
		},
		entityName: "Role",
		navigateTo: "/app/users/roles",
		queryKey: ["roles"],
	});

	return (
		<div className="space-y-4 p-4 md:px-6 bg-popover max-w-5xl mx-auto rounded-md md:shadow-sm">
			<PageHeader
				title={role ? "Edit Role" : "Create New Role"}
				description={
					role
						? `Edit ${toTitleCase(
								role.name.toLowerCase(),
							)} details and permissions`
						: "Create a new role"
				}
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<form.AppField name="name">
					{(field) => (
						<field.Input placeholder="Trainer" required label="Role Name" />
					)}
				</form.AppField>
				<form.Field name="permissions">
					{(field) => (
						<PermissionMatrix
							permissions={permissions}
							defaultSelectedIds={field.state.value}
							onChange={(ids) => field.handleChange(ids)}
						/>
					)}
				</form.Field>
				<form.AppForm>
					<form.SubmitButton
						buttonText={role ? "Update Role" : "Create Role"}
					/>
				</form.AppForm>
			</form>
		</div>
	);
}
