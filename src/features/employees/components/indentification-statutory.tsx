import { FieldGroup, FieldSet } from "@/components/ui/field";
import { withForm } from "@/lib/form";
import { employeeFormOpts } from "../utils/helpers";

export const FieldGroupEmployeeIdentificationStatutory = withForm({
	...employeeFormOpts,
	render: ({ form }) => {
		return (
			<FieldSet>
				<FieldGroup className="grid md:grid-cols-2">
					<form.AppField name="kraPin">
						{(field) => (
							<field.Input
								label="KRA PIN"
								placeholder="Enter KRA PIN"
								maxLength={11}
							/>
						)}
					</form.AppField>
					<form.AppField name="nssfNo">
						{(field) => (
							<field.Input
								label="NSSF Number"
								placeholder="Enter NSSF Number"
							/>
						)}
					</form.AppField>
					<form.AppField name="shifNo">
						{(field) => (
							<field.Input
								label="SHIF Number"
								placeholder="Enter SHIF Number"
							/>
						)}
					</form.AppField>
					<form.AppField name="helbRef">
						{(field) => (
							<field.Input label="HELB Ref" placeholder="Enter HELB Ref" />
						)}
					</form.AppField>
					<form.AppField name="nationalId">
						{(field) => (
							<field.Input
								label="National ID"
								placeholder="Enter National ID"
							/>
						)}
					</form.AppField>
				</FieldGroup>
			</FieldSet>
		);
	},
});
