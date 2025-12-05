import {
	FieldDescription,
	FieldGroup,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppForm } from "@/lib/form";
import { type SettingsSchema, settingsSchema } from "../services/schemas";

export function SettingsForm() {
	const form = useAppForm({
		defaultValues: {
			settings: {
				logRetentionDays: 180,
			},
		} as SettingsSchema,
		validators: {
			onSubmit: settingsSchema,
		},
	});
	return (
		<form>
			<FieldGroup className="grid md:grid-cols-2 border-b">
				<FieldSet>
					<FieldLegend className="text-primary">
						Data Retention & Privacy
					</FieldLegend>
					<FieldDescription>
						Manage data retention and privacy settings
					</FieldDescription>
					<form.AppField name="settings.logRetentionDays">
						{(field) => (
							<field.Input
								label="Log Retention Days"
								helperText="No of days to keep activity logs"
							/>
						)}
					</form.AppField>
				</FieldSet>
			</FieldGroup>
		</form>
	);
}
