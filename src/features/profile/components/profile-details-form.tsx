import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import type { Attachment } from "@/components/ui/form-uploader";
import { FormUploader } from "@/components/ui/form-uploader";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import { TrashIcon } from "@/components/ui/icons";
import {
	profileDetailsSchema,
	type ProfileDetailsSchema,
} from "@/features/profile/services/schema";
import { useAppForm } from "@/lib/form";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import { authClient } from "@/lib/auth/client";
import type { User } from "@/lib/auth";

const DEFAULT_VALUES: ProfileDetailsSchema = {
	name: "",
	email: null,
	contact: "",
	image: [],
};

function buildAvatarAttachment(image: string | null | undefined): Attachment[] {
	if (!image) {
		return [];
	}

	return [
		{
			url: image,
			filename: "Avatar",
			mimeType: "image/*",
		},
	];
}

export function ProfileDetailsForm({ user }: { user?: User }) {
	const updateMutation = useMutation({
		mutationFn: async (data: {
			name: string;
			contact: string;
			image: string | null;
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
			name: user.name ?? "",
			email: user.email ?? null,
			contact: user.contact ?? "",
			image: buildAvatarAttachment(user.image),
		};
	}, [user]);

	const form = useAppForm({
		defaultValues,
		validators: {
			onSubmit: profileDetailsSchema,
		},
		onSubmit: ({ value }) => {
			const image = value.image?.[0]?.url ?? null;
			updateMutation.mutate({
				name: value.name,
				contact: value.contact,
				image,
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
							helperText="Email updates are managed separately"
						/>
					)}
				</form.AppField>
				<div className="col-span-full">
					<form.Field name="image">
						{(field) => (
							<div className="space-y-3 max-w-lg">
								<Field>
									<FieldLabel>Avatar</FieldLabel>
									<FormUploader
										value={field.state.value ?? []}
										onChange={(newAttachments) =>
											field.handleChange(newAttachments.slice(-1))
										}
									/>
								</Field>
								{field.state.value?.map((attachment, index) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: <>
										key={index}
										className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm"
									>
										<div className="flex items-center gap-3">
											<div className="p-2 bg-primary/10 rounded-full">
												<span className="text-primary text-xs">🖼️</span>
											</div>
											<div className="flex flex-col">
												<span className="text-sm font-medium truncate max-w-[200px]">
													{attachment.filename}
												</span>
												<Button
													asChild
													variant="link"
													size="sm"
													className="justify-start"
												>
													<a
														href={attachment.url}
														target="_blank"
														rel="noopener noreferrer"
													>
														View
													</a>
												</Button>
											</div>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => field.removeValue(index)}
											className="text-destructive hover:text-destructive/80"
										>
											<TrashIcon className="size-4" />
										</Button>
									</div>
								))}
							</div>
						)}
					</form.Field>
				</div>
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
