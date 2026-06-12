import { FieldGroup, FieldSet } from "@/components/ui/field";
import { SelectItem } from "@/components/ui/select";
import { EMPLOYMENT_TYPES } from "@/drizzle/schema";
import { withForm } from "@/lib/form";
import { employeeFormOpts, formatText } from "../utils/helpers";

export const FieldGroupEmployeeEmployment = withForm({
	...employeeFormOpts,
	render: ({ form }) => {
		return (
			<FieldSet>
				<FieldGroup className="grid md:grid-cols-2">
					<form.AppField name="employmentType">
						{(field) => (
							<field.Select label="Employment Type">
								{EMPLOYMENT_TYPES.map((t) => (
									<SelectItem key={t} value={t}>
										{formatText(t)}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="jobTitle">
						{(field) => (
							<field.Input label="Job Title" placeholder="Enter Job Title" />
						)}
					</form.AppField>
					<form.AppField name="hireDate">
						{(field) => (
							<field.Input
								label="Hire Date"
								placeholder="Enter Hire Date"
								type="date"
							/>
						)}
					</form.AppField>
					<form.AppField name="terminationDate">
						{(field) => (
							<field.Input
								label="Termination Date"
								placeholder="Enter Termination Date"
								type="date"
							/>
						)}
					</form.AppField>
				</FieldGroup>
			</FieldSet>
		);
	},
});
