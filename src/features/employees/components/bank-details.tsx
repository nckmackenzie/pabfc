import { FieldGroup, FieldSet } from "@/components/ui/field";
import { withForm } from "@/lib/form";
import { employeeFormOpts } from "../utils/helpers";

export const FieldGroupEmployeeBank = withForm({
	...employeeFormOpts,
	render: ({ form }) => {
		return (
			<FieldSet>
				<FieldGroup className="grid md:grid-cols-2">
					<form.AppField name="bankName">
						{(field) => (
							<field.Input label="Bank Name" placeholder="Enter Bank Name" />
						)}
					</form.AppField>
					<form.AppField name="bankAccountNo">
						{(field) => (
							<field.Input
								label="Bank Account Number"
								placeholder="Enter Bank Account Number"
							/>
						)}
					</form.AppField>
					<form.AppField name="bankBranch">
						{(field) => (
							<field.Input
								label="Bank Branch"
								placeholder="Enter Bank Branch"
							/>
						)}
					</form.AppField>
				</FieldGroup>
			</FieldSet>
		);
	},
});
