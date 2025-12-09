import { getRouteApi } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { CheckIcon, ResetIcon, XIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SelectItem } from "@/components/ui/select";
import {
	type PaymentSchema,
	paymentSchema,
} from "@/features/payments/services/schemas";
import { useAppForm } from "@/lib/form";
import { generateRandomId } from "@/lib/utils";

export function PaymentForm() {
	const { members, plans } = getRouteApi("/app/payments/new").useLoaderData();
	const form = useAppForm({
		defaultValues: {
			planId: "",
			memberId: "",
			paymentDate: new Date().toISOString(),
			amount: 0,
		} as PaymentSchema,
		validators: {
			onSubmit: paymentSchema,
		},
	});
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<form.AppField name="paymentDate">
					{(field) => <field.Input label="Date" required type="date" />}
				</form.AppField>
				<form.AppField name="memberId">
					{(field) => (
						<field.Combobox
							label="Member"
							required
							items={members}
							placeholder="Select a member"
						/>
					)}
				</form.AppField>
			</FieldGroup>
			<FieldGroup className="grid lg:grid-cols-3 gap-4">
				<ReadonlyFields
					label="Current Plan"
					value=""
					id={generateRandomId("member")}
				/>
				<ReadonlyFields
					label="Start Date"
					value=""
					id={generateRandomId("startDate")}
				/>
				<ReadonlyFields
					label="End Date"
					value=""
					id={generateRandomId("endDate")}
				/>
			</FieldGroup>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<form.AppField name="planId">
					{(field) => (
						<field.Select label="Plan" required placeholder="Select a plan">
							{plans.map((plan) => (
								<SelectItem key={plan.value} value={plan.value}>
									{plan.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="amount">
					{(field) => <field.Input label="Amount" required type="number" />}
				</form.AppField>
			</FieldGroup>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<ReadonlyFields
					label="New Start Date"
					value=""
					id={generateRandomId("newStartDate")}
				/>
				<ReadonlyFields
					label="New End Date"
					value=""
					id={generateRandomId("newEndDate")}
				/>
			</FieldGroup>
			<FieldGroup>
				<Field>
					<FieldLabel>Phone Number</FieldLabel>
					<Input />
				</Field>
			</FieldGroup>
			<Alert variant="warning">
				<AlertTitle>Alert Title</AlertTitle>
				<AlertDescription>This is the content of the alert.</AlertDescription>
			</Alert>

			<div className="flex items-center gap-4">
				<Button type="submit" size="lg" className="self-end">
					<CheckIcon />
					Prompt Payment
				</Button>
				<Button
					type="button"
					variant="secondary"
					size="lg"
					className="self-end"
				>
					<ResetIcon />
					Select from Pending Payments
				</Button>
				<Button
					onClick={() => {
						form.reset();
					}}
					variant="outline"
					size="lg"
					className="self-end"
					type="reset"
				>
					<XIcon />
					Cancel
				</Button>
			</div>
		</form>
	);
}

type ReadonlyFieldsProps = {
	label: string;
	value: string;
	id: string;
};

function ReadonlyFields({ label, value, id }: ReadonlyFieldsProps) {
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input id={id} value={value} className="bg-secondary" readOnly />
		</Field>
	);
}
