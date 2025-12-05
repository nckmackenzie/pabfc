import { useStore } from "@tanstack/react-form";
import { FieldGroup } from "@/components/ui/field";
import { useSettingsMutation } from "@/features/settings/hooks/useSettingsMutation";
import { upsertNotificationSettings } from "@/features/settings/services/settings.api";
import { useAppForm } from "@/lib/form";
import {
	type SettingsNotificationSchema,
	settingsNotificationSchema,
} from "../services/schemas";

export function NotificationsForm({
	notificationSettings,
}: {
	notificationSettings?: SettingsNotificationSchema;
}) {
	const dataMutation = useSettingsMutation({
		actionFn: upsertNotificationSettings,
		queryKey: ["settings"],
		errorMessage: "Error updating settings",
		displaySuccessToast: true,
	});
	const form = useAppForm({
		defaultValues:
			notificationSettings ??
			({
				enableSmsNotifications: false,
				daysBeforeRenewalReminder: null,
				sendPaymentReceiptViaEmail: false,
			} as SettingsNotificationSchema),
		validators: {
			onSubmit: settingsNotificationSchema,
		},
		onSubmit: ({ value }) => {
			dataMutation.mutate({ data: { data: value } });
		},
	});

	const notificationsEnabled = useStore(
		form.store,
		(state) => state.values.enableSmsNotifications,
	);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.AppField name="enableSmsNotifications">
					{(field) => (
						<field.Checkbox
							label="Enable SMS Notifications"
							helperText="Enable SMS notifications for users."
						/>
					)}
				</form.AppField>
				<form.AppField name="daysBeforeRenewalReminder">
					{(field) => (
						<field.Input
							label="Days Before Renewal Reminder"
							placeholder="Enter days before renewal reminder"
							type="number"
							helperText="Number of days before a user is reminded to renew their subscription."
							disabled={!notificationsEnabled}
						/>
					)}
				</form.AppField>
				<form.AppField name="sendPaymentReceiptViaEmail">
					{(field) => (
						<field.Checkbox
							label="Send Payment Receipt Via Email"
							helperText="Send payment receipt via email."
						/>
					)}
				</form.AppField>

				<div className="col-span-full">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Save Notification Settings"
							withReset
							isLoading={dataMutation.isPending}
						/>
					</form.AppForm>
				</div>
			</FieldGroup>
		</form>
	);
}
