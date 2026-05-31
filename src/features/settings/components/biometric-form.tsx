import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { ArrowClockWiseIcon, CheckIcon } from "@/components/ui/icons";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { useSettingsMutation } from "@/features/settings/hooks/useSettingsMutation";
import {
	type BiometricSettingsSchema,
	biometricSettingsSchema,
} from "@/features/settings/services/schemas";
import { upsertBiotimeSettings } from "@/features/settings/services/settings.api";
import { useAppForm } from "@/lib/form";

export function BiometricForm({
	biometricSettings,
}: {
	biometricSettings?: BiometricSettingsSchema;
}) {
	const saveMutation = useSettingsMutation({
		actionFn: upsertBiotimeSettings,
		queryKey: ["biotimeSettings"],
		errorMessage: "Error updating biometric settings",
		displaySuccessToast: true,
	});

	const form = useAppForm({
		defaultValues:
			biometricSettings ??
			({
				baseUrl: "http://127.0.0.1/",
				username: "",
				password: "",
				defaultDepartmentId: 1,
				authorizedAreaId: 2,
				unauthorizedAreaId: 1,
				deviceSerialNumber: null,
				syncEnabled: true,
				pollIntervalSeconds: 30,
				batchSize: 10,
			} as BiometricSettingsSchema),
		validators: {
			onSubmit: biometricSettingsSchema,
		},
		onSubmit: ({ value }) => {
			saveMutation.mutate({ data: { data: value } });
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
				<form.AppField name="baseUrl">
					{(field) => (
						<field.Input
							label="BioTime Base URL"
							placeholder="Enter BioTime base URL"
							type="url"
							required
							helperText="Base URL used to reach your BioTime service."
						/>
					)}
				</form.AppField>
				<form.AppField name="username">
					{(field) => (
						<field.Input
							label="Username"
							placeholder="Enter BioTime username"
							type="text"
							required
							helperText="System username used to authenticate against the BioTime API."
						/>
					)}
				</form.AppField>
				<form.AppField name="password">
					{(field) => (
						<field.Input
							label="Password"
							placeholder="Enter BioTime password"
							type="password"
							required
							isPassword
							helperText="Stored encrypted with BETTER_AUTH_SECRET before saving."
						/>
					)}
				</form.AppField>
				<form.AppField name="defaultDepartmentId">
					{(field) => (
						<field.Input
							label="Default Department ID"
							placeholder="Enter default department ID"
							type="number"
							required
							helperText="Department ID applied when no department is provided."
						/>
					)}
				</form.AppField>
				<form.AppField name="authorizedAreaId">
					{(field) => (
						<field.Input
							label="Authorized Area ID"
							placeholder="Enter authorized area ID"
							type="number"
							required
							helperText="Area assigned to members with valid access."
						/>
					)}
				</form.AppField>
				<form.AppField name="unauthorizedAreaId">
					{(field) => (
						<field.Input
							label="Unauthorized Area ID"
							placeholder="Enter unauthorized area ID"
							type="number"
							required
							helperText="Area assigned to members without authorized access."
						/>
					)}
				</form.AppField>
				<form.AppField name="deviceSerialNumber">
					{(field) => (
						<field.Input
							label="Device Serial Number"
							placeholder="Enter device serial number"
							type="text"
							helperText="Optional serial number for the BioTime-connected device."
						/>
					)}
				</form.AppField>
				<form.AppField name="syncEnabled">
					{(field) => (
						<field.Switch
							label="Sync Enabled"
							helperText="Turn off to pause BioTime synchronization without clearing the configuration."
						/>
					)}
				</form.AppField>
				<form.AppField name="pollIntervalSeconds">
					{(field) => (
						<field.Input
							label="Poll Interval"
							placeholder="Enter poll interval in seconds"
							type="number"
							helperText="How often the system should poll BioTime, in seconds."
						/>
					)}
				</form.AppField>
				<form.AppField name="batchSize">
					{(field) => (
						<field.Input
							label="Batch Size"
							placeholder="Enter batch size"
							type="number"
							helperText="Maximum number of records processed in one sync batch."
						/>
					)}
				</form.AppField>

				<div className="col-span-full">
					<form.AppForm>
						<div className="flex flex-col gap-2 sm:flex-row">
							<Button type="submit" disabled={saveMutation.isPending}>
								<LoadingSwap isLoading={saveMutation.isPending}>
									<CheckIcon />
									Save
								</LoadingSwap>
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={saveMutation.isPending}
								onClick={() => form.reset()}
							>
								<ArrowClockWiseIcon />
								Cancel
							</Button>
						</div>
					</form.AppForm>
				</div>
			</FieldGroup>
		</form>
	);
}
