import { Link, useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { GoogleIcon } from "@/components/ui/icons";
import { ToastContent } from "@/components/ui/toast-content";
import { loginSchema } from "@/features/auth/login/services/schemas";
import {
	sanitizeRedirect,
	usePreviousLocation,
} from "@/hooks/use-previous-location";
import { authClient } from "@/lib/auth/client";
import { useAppForm } from "@/lib/form";

export function MemberLoginForm({ redirectTo }: { redirectTo?: string }) {
	const previousLocation = usePreviousLocation();
	const navigate = useNavigate({ from: "/member/login" });
	const form = useAppForm({
		defaultValues: { username: "", password: "" },
		validators: {
			onSubmit: loginSchema,
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.username({
				username: value.username,
				password: value.password,
				fetchOptions: {
					headers: {
						"x-login-type": "member",
					},
					onError: (error) => {
						toast.error((t) => (
							<ToastContent
								message={error.error.message ?? "An unknown error occurred"}
								title="Login Error"
								t={t}
							/>
						));
					},
					onSuccess: async () => {
						const target = sanitizeRedirect(redirectTo ?? previousLocation);
						form.reset();
						navigate({ to: target, replace: true });
					},
				},
			});
		},
	});
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="self-stretch space-y-4"
		>
			<FieldGroup>
				<form.AppField name="username">
					{(field) => {
						return (
							<field.Input
								required
								label="Phone No"
								placeholder="Enter your phone number"
							/>
						);
					}}
				</form.AppField>
				<form.AppField name="password">
					{(field) => {
						return (
							<field.Input
								required
								label="Password"
								type="password"
								placeholder="Enter your password"
							/>
						);
					}}
				</form.AppField>
			</FieldGroup>
			<Link
				className="text-sm block text-right text-blue-800 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors"
				to="/forgot-password"
			>
				Forgot password?
			</Link>
			<FieldGroup>
				<form.AppForm>
					<form.SubmitButton
						orientation="vertical"
						buttonText="Login"
						withReset={false}
						buttonSize="lg"
						icon={<LogOutIcon />}
					/>
				</form.AppForm>
			</FieldGroup>
			<FieldGroup>
				<div className="relative flex items-center py-5">
					<div className="grow border-t border-gray-300"></div>
					<span className="shrink mx-4 text-gray-600 text-sm">
						Or continue with
					</span>
					<div className="grow border-t border-gray-300"></div>
				</div>
				<Button variant="outline" size="lg" disabled>
					<GoogleIcon />
					Sign in with Google
				</Button>
			</FieldGroup>
		</form>
	);
}
