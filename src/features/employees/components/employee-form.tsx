import { useStore } from "@tanstack/react-form";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/ui/permission-gate";
import { SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EMPLOYMENT_STATUSES, gender } from "@/drizzle/schema";
import { upsertEmployee } from "@/features/employees/services/employees.api";
import type { EmployeeSchema } from "@/features/employees/utils/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";
import {
	createEmployeeDefaultValues,
	employeeFormOpts,
	formatText,
} from "../utils/helpers";
import { FieldGroupEmployeeBank } from "./bank-details";
import { FieldGroupEmployeeContact } from "./contact-information";
import { FieldGroupEmployeeEmployment } from "./employment-details";
import { FieldGroupEmployeeIdentificationStatutory } from "./indentification-statutory";

type EmployeeFormProps = {
	employee?: EmployeeSchema;
	generatedEmployeeNo?: string;
};

export function EmployeeForm({
	employee,
	generatedEmployeeNo,
}: EmployeeFormProps) {
	const employeeMutation = useFormUpsert({
		upsertFn: (data: EmployeeSchema) => upsertEmployee({ data }),
		entityName: "Employee",
		navigateTo: "/app/employees",
		queryKey: ["employees"],
		onReset: () => form.reset(),
	});

	const form = useAppForm({
		...employeeFormOpts,
		defaultValues: employee ?? createEmployeeDefaultValues(generatedEmployeeNo),
		onSubmit: ({ value }) => {
			employeeMutation.mutate({
				...value,
				id: employee?.id,
			});
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	const isEditing = Boolean(employee?.id);

	usePreventUnsavedChanges(isDirty);

	return (
		<div className="space-y-6 bg-card p-6 border rounded-md max-w-3xl">
			<PageHeader
				title={isEditing ? "Edit Employee" : "Add New Employee"}
				description={
					isEditing
						? "Update employee information"
						: "Add a new employee to the system"
				}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-6"
			>
				<FieldSet>
					<FieldLegend>Personal Information</FieldLegend>
					<FieldGroup className="grid md:grid-cols-2 max-w-xl">
						<form.AppField name="firstName">
							{(field) => (
								<field.Input
									label="First Name"
									required
									placeholder="Enter First Name"
								/>
							)}
						</form.AppField>
						<form.AppField name="lastName">
							{(field) => (
								<field.Input
									label="Last Name"
									required
									placeholder="Enter Last Name"
								/>
							)}
						</form.AppField>
						<form.AppField name="gender">
							{(field) => (
								<field.Select label="Gender">
									{gender.map((gender) => (
										<SelectItem key={gender} value={gender}>
											{formatText(gender)}
										</SelectItem>
									))}
								</field.Select>
							)}
						</form.AppField>
						<form.AppField name="dateOfBirth">
							{(field) => <field.Input label="Date Of Birth" type="date" />}
						</form.AppField>
						<form.AppField name="status">
							{(field) => (
								<field.Select label="Status" required>
									{EMPLOYMENT_STATUSES.map((status) => (
										<SelectItem key={status} value={status}>
											{formatText(status)}
										</SelectItem>
									))}
								</field.Select>
							)}
						</form.AppField>
						<form.AppField name="employeeNo">
							{(field) => (
								<field.Input
									label="Employee No"
									readOnly
									className="font-mono"
								/>
							)}
						</form.AppField>
					</FieldGroup>
				</FieldSet>
				<Tabs defaultValue="contact" className="border rounded-md">
					<TabsList variant="line" className="bg-muted/30 w-full">
						<TabsTrigger value="contact">Contact Information</TabsTrigger>
						<PermissionGate permissions={["employees:payroll-information"]}>
							<TabsTrigger value="next-of-kin">
								Identification & Statutory
							</TabsTrigger>
							<TabsTrigger value="employment">Employment Details</TabsTrigger>
							<TabsTrigger value="dependants">Payment Details</TabsTrigger>
						</PermissionGate>
					</TabsList>
					<TabsContent value="contact" className="p-4">
						<FieldGroupEmployeeContact form={form} />
					</TabsContent>
					<PermissionGate permissions={["employees:payroll-information"]}>
						<TabsContent value="next-of-kin" className="p-4">
							<FieldGroupEmployeeIdentificationStatutory form={form} />
						</TabsContent>
						<TabsContent value="employment" className="p-4">
							<FieldGroupEmployeeEmployment form={form} />
						</TabsContent>
						<TabsContent value="dependants" className="p-4">
							<FieldGroupEmployeeBank form={form} />
						</TabsContent>
					</PermissionGate>
				</Tabs>
				<FieldGroup>
					<form.AppForm>
						<form.SubmitButton
							withReset
							buttonText={isEditing ? "Update Employee" : "Create Employee"}
							isLoading={employeeMutation.isPending}
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
