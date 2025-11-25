import { useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
	ClipboardCheckIcon,
	ClipboardDocumentIcon,
} from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToastContent } from "@/components/ui/toast-content";
import {
	type ResetPasswordFormValues,
	resetPasswordFormSchema,
} from "@/features/users/services/schema";
import { resetPassword } from "@/features/users/services/users.api";
import { useAppForm } from "@/lib/form";

const RESET_PASSWORD_METHODS = [
	{
		value: "automatic",
		label: "Automatically generate a new password.",
	},
	{
		value: "manual",
		label: "Manually set a new password for the user.",
	},
];

export function ResetPasswordForm() {
	const { userId } = getRouteApi("/app/users/$userId/reset").useParams();

	const mutation = useMutation({
		mutationFn: async (data: ResetPasswordFormValues) => {
			return await resetPassword({ data });
		},
	});

	const form = useAppForm({
		defaultValues: {
			resetMethod: "automatic",
			password: null,
			userId,
		} as ResetPasswordFormValues,
		validators: {
			onSubmit: resetPasswordFormSchema,
		},
		onSubmit: ({ value }) => {
			mutation.mutate(value, {
				onSuccess: () => {
					form.reset();
				},
				onError: () => {
					toast.error((t) => (
						<ToastContent
							t={t}
							title="Error resetting password"
							message="An error occured while resetting the password."
						/>
					));
				},
			});
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	useEffect(() => {
		if (isDirty && mutation.data) {
			mutation.reset();
		}
	}, [isDirty, mutation]);

	return (
		<div className="space-y-6">
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="resetMethod">
					{(field) => (
						<RadioGroup
							defaultValue={field.state.value}
							value={field.state.value}
							onValueChange={(val) => {
								field.form.resetField("password");
								field.handleChange(
									val as ResetPasswordFormValues["resetMethod"],
								);
							}}
						>
							{RESET_PASSWORD_METHODS.map((method) => (
								<div key={method.value} className="flex items-center space-x-2">
									<RadioGroupItem value={method.value} id={method.value} />
									<Label htmlFor={method.value} className="font-normal text-sm">
										{method.label}
									</Label>
								</div>
							))}
						</RadioGroup>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => state.values.resetMethod}>
					{(resetMethod) =>
						resetMethod === "manual" && (
							<form.AppField name="password">
								{(field) => (
									<field.Input
										type="password"
										placeholder="*******"
										label="Password"
										isPassword
									/>
								)}
							</form.AppField>
						)
					}
				</form.Subscribe>
				<form.AppForm>
					<form.SubmitButton
						buttonText="Reset Password"
						withReset={false}
						orientation="horizontal"
						isLoading={mutation.isPending}
					/>
				</form.AppForm>
			</form>
			{mutation.data && (
				<SuccessAlert
					newPassword={mutation.data}
					resetMethod={mutation.variables?.resetMethod || "automatic"}
				/>
			)}
		</div>
	);
}

function SuccessAlert({
	newPassword,
	resetMethod,
}: {
	newPassword: string;
	resetMethod: "manual" | "automatic";
}) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (copied) {
			const timer = setTimeout(() => setCopied(false), 5000);
			return () => clearTimeout(timer);
		}
	}, [copied]);

	return (
		<div className="rounded-md bg-green-50 p-4">
			<div className="flex">
				<div className="shrink-0">
					<svg
						className="h-5 w-5 text-green-400"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fillRule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clipRule="evenodd"
						/>
					</svg>
				</div>
				<div className="ml-3 space-y-2">
					<h3 className="text-sm font-medium text-green-800">Password Reset</h3>
					<div className="mt-2 text-sm text-green-700">
						<p>The user's password has been reset successfully.</p>
						<p>
							<strong>New Password:</strong> {newPassword}
						</p>
					</div>
					{resetMethod === "automatic" && (
						<Button
							variant="outline"
							disabled={copied}
							onClick={() => {
								navigator.clipboard.writeText(newPassword);
								setCopied(true);
							}}
						>
							{copied ? (
								<>
									<ClipboardCheckIcon />
									<span>Password Copied</span>
								</>
							) : (
								<>
									<ClipboardDocumentIcon />
									<span>Copy Password</span>
								</>
							)}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
