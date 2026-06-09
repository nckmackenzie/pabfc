import { Link } from "@tanstack/react-router";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import {
	completeTemporaryPasswordReset,
	requestTemporaryPasswordReset,
} from "@/features/auth/forgot-password/services/forgot-password.api";
import {
	completeTemporaryPasswordResetSchema,
	requestTemporaryPasswordResetSchema,
} from "@/features/auth/forgot-password/services/schemas";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import { useAppForm } from "@/lib/form";

type ForgotPasswordStep = "request" | "reset" | "success";

function showErrorToast(error: unknown) {
	console.error(error);
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
			message="An unexpected error occurred. Please try again."
		/>
	));
}

function RequestTemporaryPasswordForm({
	onRequested,
}: {
	onRequested: (identifier: string) => void;
}) {
	const form = useAppForm({
		defaultValues: { identifier: "" },
		validators: {
			onSubmit: requestTemporaryPasswordResetSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const response = await requestTemporaryPasswordReset({ data: value });
				toast.success((t) => (
					<ToastContent
						t={t}
						title="Check your phone"
						message={response.message}
					/>
				));
				onRequested(value.identifier);
			} catch (error) {
				showErrorToast(error);
			}
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
			<FieldGroup>
				<form.AppField name="identifier">
					{(field) => (
						<field.Input
							label="Phone, username, or email"
							placeholder="0712345678"
						/>
					)}
				</form.AppField>
				<form.AppForm>
					<form.SubmitButton
						buttonText="Send Temporary Password"
						orientation="vertical"
						withReset={false}
					/>
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}

function CompleteResetForm({
	identifier,
	onComplete,
}: {
	identifier: string;
	onComplete: () => void;
}) {
	const form = useAppForm({
		defaultValues: {
			identifier,
			temporaryPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		validators: {
			onSubmit: completeTemporaryPasswordResetSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await completeTemporaryPasswordReset({ data: value });
				toast.success((t) => (
					<ToastContent
						t={t}
						title="Password reset"
						message="You can now sign in with your new password."
					/>
				));
				onComplete();
			} catch (error) {
				showErrorToast(error);
			}
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
			<FieldGroup>
				<p className="text-sm text-muted-foreground">
					Enter the temporary password sent by SMS, then choose your new
					password.
				</p>
				<form.AppField name="identifier">
					{(field) => (
						<field.Input
							label="Phone, username, or email"
							placeholder="0712345678"
						/>
					)}
				</form.AppField>
				<form.AppField name="temporaryPassword">
					{(field) => (
						<field.Input
							isPassword
							label="Temporary Password"
							placeholder="Temporary password"
						/>
					)}
				</form.AppField>
				<form.AppField name="newPassword">
					{(field) => (
						<field.Input
							isPassword
							label="New Password"
							placeholder="New password"
						/>
					)}
				</form.AppField>
				<form.AppField name="confirmPassword">
					{(field) => (
						<field.Input
							isPassword
							label="Confirm New Password"
							placeholder="Confirm new password"
						/>
					)}
				</form.AppField>
				<form.AppForm>
					<form.SubmitButton
						buttonText="Reset Password"
						orientation="vertical"
						withReset={false}
					/>
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}

export function ForgotPasswordForm() {
	const [step, setStep] = useState<ForgotPasswordStep>("request");
	const [identifier, setIdentifier] = useState("");

	if (step === "success") {
		return (
			<FieldGroup>
				<div className="space-y-2 text-center">
					<h1 className="font-bold text-2xl">Password Reset</h1>
					<p className="text-muted-foreground text-sm">
						Your password has been updated successfully.
					</p>
				</div>
				<Button asChild>
					<Link to="/sign-in">Return to Sign In</Link>
				</Button>
			</FieldGroup>
		);
	}

	return (
		<div className="flex w-full flex-col gap-y-6">
			<div className="flex flex-col text-center">
				<h1 className="font-bold text-2xl">Forgot Password</h1>
				<p className="text-muted-foreground text-sm">
					Reset your account password by SMS.
				</p>
			</div>
			{step === "request" ? (
				<RequestTemporaryPasswordForm
					onRequested={(requestedIdentifier) => {
						setIdentifier(requestedIdentifier);
						setStep("reset");
					}}
				/>
			) : (
				<CompleteResetForm
					key={identifier}
					identifier={identifier}
					onComplete={() => setStep("success")}
				/>
			)}
			<Link
				className="text-primary text-sm text-center font-medium transition-all hover:underline"
				to="/sign-in"
			>
				Back to Sign In
			</Link>
		</div>
	);
}
