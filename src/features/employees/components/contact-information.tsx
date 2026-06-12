import { FieldGroup, FieldSet } from "@/components/ui/field";
import { withForm } from "@/lib/form";
import { employeeFormOpts } from "../utils/helpers";

export const FieldGroupEmployeeContact = withForm({
	...employeeFormOpts,
	render: ({ form }) => {
		return (
			<FieldSet>
				<FieldGroup className="grid md:grid-cols-2">
					<form.AppField name="phone">
						{(field) => (
							<field.Input
								label="Phone Number"
								required
								placeholder="Enter Phone Number"
								type="tel"
							/>
						)}
					</form.AppField>
					<form.AppField name="email">
						{(field) => (
							<field.Input
								label="Email Address"
								placeholder="Enter Email Address"
								type="email"
							/>
						)}
					</form.AppField>
					<form.AppField name="emergencyContact">
						{(field) => (
							<field.Input
								label="Emergency Contact"
								placeholder="Enter Emergency Contact"
							/>
						)}
					</form.AppField>
					<form.AppField name="nextOfKin">
						{(field) => (
							<field.Input
								label="Next of Kin"
								placeholder="Enter Next of Kin"
							/>
						)}
					</form.AppField>
				</FieldGroup>
			</FieldSet>
		);
	},
});
