import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { FieldGroup } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import {
	profileDetailsSchema,
	type ProfileDetailsSchema,
} from "@/features/profile/services/schema";
import { useAppForm } from "@/lib/form";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import { authClient } from "@/lib/auth/client";
import type { User } from "@/lib/auth";
import { toTitleCase } from "@/lib/utils";

const DEFAULT_VALUES: ProfileDetailsSchema = {
	name: "",
	email: null,
	contact: "",
};


export function ProfileDetailsForm({ user }: { user?: User }) {
	const updateMutation = useMutation({
		mutationFn: async (data: {
			name: string;
			contact: string;
		}) => {
			const response = await authClient.updateUser(data);
			if (response.error) {
				throw new Error(response.error.message || "Failed to update profile");
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
					message="Error updating profile"
				/>
			));
		},
		onSuccess: () => {
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Success"
					message="Profile updated successfully"
				/>
			));
		},
	});

	const defaultValues = useMemo<ProfileDetailsSchema>(() => {
		if (!user) {
			return DEFAULT_VALUES;
		}

		return {
			name: toTitleCase(user.name ?? ""),
			email: user.email ?? null,
			contact: user.contact ?? "",
		};
	}, [user]);

	const form = useAppForm({
		defaultValues,
		validators: {
			onSubmit: profileDetailsSchema,
		},
		onSubmit: ({ value }) => {
			updateMutation.mutate({
				name: value.name,
				contact: value.contact,
			});
		},
	});

	useEffect(() => {
		form.reset(defaultValues);
	}, [defaultValues, form]);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
			className="max-w-4xl rounded-lg p-6 border"
		>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<form.AppField name="name">
					{(field) => (
						<field.Input
							label="Full Name"
							required
							placeholder="eg Jane Doe"
						/>
					)}
				</form.AppField>
				<form.AppField name="contact">
					{(field) => (
						<field.Input
							label="Contact"
							required
							placeholder="eg 0712345678"
						/>
					)}
				</form.AppField>
				<form.AppField name="email">
					{(field) => (
						<field.Input
							label="Email"
							placeholder="you@example.com"
							disabled
						/>
					)}
				</form.AppField>
				<div className="col-span-full">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Save Profile"
							withReset
							isLoading={updateMutation.isPending}
						/>
					</form.AppForm>
				</div>
			</FieldGroup>
		</form>
	);
}
