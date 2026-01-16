import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FieldGroup } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import {
	profileSecuritySchema,
	type ProfileSecuritySchema,
} from "@/features/profile/services/schema";
import { authClient } from "@/lib/auth/client";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import { useAppForm } from "@/lib/form";

const DEFAULT_VALUES: ProfileSecuritySchema = {
	currentPassword: "",
	newPassword: "",
	confirmPassword: "",
};

export function ProfileSecurityForm() {
	const changePasswordMutation = useMutation({
		mutationFn: async (data: {
			currentPassword: string;
			newPassword: string;
		}) => {
			const response = await authClient.changePassword(data);
			if (response.error) {
				throw new Error(
					response.error.message || "Failed to update password",
				);
			}
			return response.data;
		},
		onError: (error) => {
			if (error instanceof Error) {
				const parsed = parseErrorMessage(error);
				toast.error((t) => (
					<ToastContent t={t} title={parsed.title} message={parsed.message} />
				));
				return;
			}
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message="Error updating password"
				/>
			));
		},
		onSuccess: () => {
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Success"
					message="Password updated successfully"
				/>
			));
		},
	});

	const form = useAppForm({
		defaultValues: DEFAULT_VALUES,
		validators: {
			onSubmit: profileSecuritySchema,
		},
		onSubmit: ({ value }) => {
			changePasswordMutation.mutate(
				{
					currentPassword: value.currentPassword,
					newPassword: value.newPassword,
				},
				{
					onSuccess: () => {
						form.reset(DEFAULT_VALUES);
					},
				},
			);
		},
	});

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<form.AppField name="currentPassword">
					{(field) => (
						<field.Input
							label="Current Password"
							required
							isPassword
							placeholder="••••••••"
						/>
					)}
				</form.AppField>
				<form.AppField name="newPassword">
					{(field) => (
						<field.Input
							label="New Password"
							required
							isPassword
							placeholder="••••••••"
						/>
					)}
				</form.AppField>
				<form.AppField name="confirmPassword">
					{(field) => (
						<field.Input
							label="Confirm New Password"
							required
							isPassword
							placeholder="••••••••"
						/>
					)}
				</form.AppField>
				<div className="col-span-full">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Update Password"
							withReset
							isLoading={changePasswordMutation.isPending}
						/>
					</form.AppForm>
				</div>
			</FieldGroup>
		</form>
	);
}
