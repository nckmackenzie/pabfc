import { useStore } from "@tanstack/react-form";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	MultiSelect,
	MultiSelectContent,
	MultiSelectGroup,
	MultiSelectItem,
	MultiSelectTrigger,
	MultiSelectValue,
} from "@/components/ui/multi-select";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { type UserSchema, userSchema } from "@/features/users/services/schema";
import { createUser, updateUser } from "@/features/users/services/users.api";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";
import type { Option } from "@/types/index.types";

const USER_TYPES = [
	{ value: "staff", label: "Staff" },
	{ value: "admin", label: "Admin" },
];

const defaultValues = {
	name: "",
	email: null,
	contact: "",
	role: "staff",
	roleIds: [],
	active: true,
} as UserSchema;

export function UserForm({
	user,
	roles,
}: {
	user?: UserSchema & { id: string };
	roles: Array<Option>;
}) {
	const userMutation = useFormMutation({
		createFn: (data: UserSchema) => createUser({ data }),
		updateFn: (userId: string, data: UserSchema) =>
			updateUser({ data: { userId, data } }),
		entityName: "User",
		queryKey: ["users"],
		navigateTo: "/app/users",
	});

	const form = useAppForm({
		defaultValues: user ?? defaultValues,
		validators: {
			onSubmit: userSchema,
		},
		onSubmit: ({ value }) => {
			userMutation.mutate(
				{ data: value, id: user?.id },
				{
					onSuccess: () => {
						form.reset();
					},
				},
			);
		},
	});

	const userType = useStore(form.store, (state) => state.values.role);

	return (
		<div className="space-y-6">
			<PageHeader
				title={user ? "Edit User" : "Create new user"}
				description={
					user
						? `Edit ${toTitleCase(user.name)} details`
						: "Add a new user to the system"
				}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="name">
						{(field) => (
							<field.Input label="Name" required placeholder="eg John Doe" />
						)}
					</form.AppField>
					<form.AppField name="contact">
						{(field) => (
							<field.Input
								label="Contact"
								required
								placeholder="eg 0712345678"
								helperText="User password will be sent here"
							/>
						)}
					</form.AppField>
					<form.AppField name="email">
						{(field) => (
							<field.Input label="Email" placeholder="eg johndoe@example.com" />
						)}
					</form.AppField>
					<form.AppField name="role">
						{(field) => (
							<field.Select
								key={user?.role}
								label="User Type"
								required
								placeholder="eg member"
							>
								{USER_TYPES.map((role) => (
									<SelectItem key={role.value} value={role.value}>
										{role.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<div className="col-span-full">
						<form.Field name="roleIds">
							{(field) => (
								<Field
									data-invalid={
										field.state.meta.isTouched && !field.state.meta.isValid
									}
								>
									<FieldLabel htmlFor={field.name}>
										Role(s){" "}
										{userType !== "admin" && (
											<span className="text-destructive">*</span>
										)}
									</FieldLabel>
									<MultiSelect
										onValuesChange={field.handleChange}
										values={field.state.value ?? []}
									>
										<MultiSelectTrigger
											className="w-full"
											disabled={userType === "admin"}
										>
											<MultiSelectValue
												overflowBehavior="cutoff"
												placeholder="Select role(s)..."
											/>
										</MultiSelectTrigger>
										<MultiSelectContent>
											<MultiSelectGroup>
												{roles.map((r) => (
													<MultiSelectItem value={r.value} key={r.value}>
														{r.label}
													</MultiSelectItem>
												))}
											</MultiSelectGroup>
										</MultiSelectContent>
									</MultiSelect>
								</Field>
							)}
						</form.Field>
					</div>
					{user && (
						<div className="col-span-full">
							<form.AppField name="active">
								{(field) => <field.Checkbox label="Active" />}
							</form.AppField>
						</div>
					)}
					<form.AppForm>
						<form.SubmitButton
							buttonText={user ? "Update user" : "Create user"}
							withReset
							isLoading={userMutation.isPending}
							orientation="horizontal"
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
