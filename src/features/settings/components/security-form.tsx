import { FieldGroup } from "@/components/ui/field";
import { useSettingsMutation } from "@/features/settings/hooks/useSettingsMutation";
import {
	type SecuritySchema,
	securitySchema,
} from "@/features/settings/services/schemas";
import { upsertSecuritySettings } from "@/features/settings/services/settings.api";
import { useAppForm } from "@/lib/form";

export function SecurityForm({
	securitySettings,
}: {
	securitySettings?: SecuritySchema;
}) {
	const dataMutation = useSettingsMutation({
		actionFn: upsertSecuritySettings,
		queryKey: ["settings"],
		errorMessage: "Error updating settings",
		displaySuccessToast: true,
	});
	const form = useAppForm({
		defaultValues:
			securitySettings ??
			({
				require2FaStaff: false,
				lockAfterAttempts: null,
				lockDurationMinutes: null,
			} as SecuritySchema),
		validators: {
			onSubmit: securitySchema,
		},
		onSubmit: ({ value }) => {
			dataMutation.mutate({ data: { data: value } });
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<form.AppField name="lockAfterAttempts">
					{(field) => (
						<field.Input
							label="Lock After Attempts"
							placeholder="Enter lock after attempts"
							type="number"
							helperText="Number of failed login attempts before a user is locked."
						/>
					)}
				</form.AppField>
				<form.AppField name="lockDurationMinutes">
					{(field) => (
						<field.Input
							label="Lock Duration Minutes"
							placeholder="Enter lock duration minutes"
							type="number"
							helperText="Number of minutes a user is locked for."
						/>
					)}
				</form.AppField>
				<form.AppField name="require2FaStaff">
					{(field) => (
						<field.Checkbox
							label="Require 2FA for Staff"
							helperText="Require 2FA for staff members."
						/>
					)}
				</form.AppField>

				<div className="col-span-full">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Save Security Settings"
							withReset
							isLoading={dataMutation.isPending}
						/>
					</form.AppForm>
				</div>
			</FieldGroup>
		</form>
	);
}
