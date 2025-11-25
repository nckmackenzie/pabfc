import { Link, useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { FieldGroup } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import { loginSchema } from "@/features/auth/login/services/schemas";
import {
	sanitizeRedirect,
	usePreviousLocation,
} from "@/hooks/use-previous-location";
import { authClient } from "@/lib/auth/client";
import { useAppForm } from "@/lib/form";

const defaultValues = {
	username: "",
	password: "",
};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
	const previousLocation = usePreviousLocation();
	const navigate = useNavigate({ from: "/sign-in" });

	const form = useAppForm({
		defaultValues,
		validators: {
			onSubmit: loginSchema,
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.username(
				{
					username: value.username,
					password: value.password,
				},
				{
					onError: (error) => {
						toast.error((t) => (
							<ToastContent
								message={error.error.message ?? "An unknown error occurred"}
								title="Login Error"
								t={t}
							/>
						));
					},
					onSuccess: () => {
						const target = sanitizeRedirect(redirectTo ?? previousLocation);
						form.reset();
						navigate({ to: target, replace: true });
						// navigate({ to: "/app/dashboard", replace: true });
					},
				},
			);
		},
	});
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.AppField name="username">
					{(field) => (
						<field.Input
							label="Contact Or Email"
							placeholder="you@example.com"
						/>
					)}
				</form.AppField>
				<form.AppField name="password">
					{(field) => (
						<field.Input isPassword label="Password" placeholder="********" />
					)}
				</form.AppField>
				<Link
					className="-mt-2 block text-sm text-right text-primary font-medium transition-all hover:underline"
					to="/forgot-password"
				>
					Forgot Password?
				</Link>
				<form.AppForm>
					<form.SubmitButton buttonText="Login" withReset={false} />
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}
