import { FieldGroup } from "@/components/ui/field";
import { useSettingsMutation } from "@/features/settings/hooks/useSettingsMutation";
import {
	type SettingsDataSchema,
	settingsDataSchema,
} from "@/features/settings/services/schemas";
import { upsertDataSettings } from "@/features/settings/services/settings.api";
import { useAppForm } from "@/lib/form";

export function DataForm({
	dataSettings,
}: {
	dataSettings?: SettingsDataSchema;
}) {
	const dataMutation = useSettingsMutation({
		actionFn: upsertDataSettings,
		queryKey: ["settings"],
		errorMessage: "Error updating settings",
		displaySuccessToast: true,
	});
	const form = useAppForm({
		defaultValues:
			dataSettings ??
			({
				logRetentionDays: 180,
			} as SettingsDataSchema),
		validators: {
			onSubmit: settingsDataSchema,
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
				<form.AppField name="logRetentionDays">
					{(field) => (
						<field.Input
							label="Log Retention Days"
							placeholder="Enter log retention days"
							type="number"
							helperText="Number of days to retain activity logs."
						/>
					)}
				</form.AppField>
				<form.AppField name="inactiveUserDays">
					{(field) => (
						<field.Input
							label="Inactive User Days"
							placeholder="Enter inactive user days"
							type="number"
							helperText="Number of days before a user is marked as inactive."
						/>
					)}
				</form.AppField>
				<form.AppField name="inactiveUserDeleteDays">
					{(field) => (
						<field.Input
							label="Inactive User Delete Days"
							placeholder="Enter inactive user delete days"
							type="number"
							helperText="Number of days before an inactive user data is deleted."
						/>
					)}
				</form.AppField>
				<form.AppField name="inactiveMemberDays">
					{(field) => (
						<field.Input
							label="Inactive Member Days"
							placeholder="Enter inactive member days"
							type="number"
							helperText="Number of days before a member is marked as inactive."
						/>
					)}
				</form.AppField>
				<form.AppField name="inactiveMemberDeleteDays">
					{(field) => (
						<field.Input
							label="Inactive Member Delete Days"
							placeholder="Enter inactive member delete days"
							type="number"
							helperText="Number of days before an inactive member data is deleted."
						/>
					)}
				</form.AppField>
				<div className="col-span-full">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Save Data & Privacy Settings"
							withReset
							isLoading={dataMutation.isPending}
						/>
					</form.AppForm>
				</div>
			</FieldGroup>
		</form>
	);
}
