import { useStore } from "@tanstack/react-form";
import { useQueries } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { CheckIcon, ResetIcon, XIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SelectItem } from "@/components/ui/select";
import { getMemberPreviousPlanDetails } from "@/features/members/services/members.queries.api";
import { memberQueries } from "@/features/members/services/queries";
import {
	type PaymentSchema,
	paymentSchema,
} from "@/features/payments/services/schemas";
import { useAppForm } from "@/lib/form";
import { generateRandomId } from "@/lib/utils";
import { usePaymentStatus } from "../hooks/use-payment-status";
import { useStkPush } from "../hooks/use-stk-push";

export function PaymentForm() {
	const { members, plans } = getRouteApi("/app/payments/new").useLoaderData();

	const stkMutation = useStkPush();
	const statusQuery = usePaymentStatus(
		stkMutation.data?.checkoutRequestId ?? null,
	);

	const form = useAppForm({
		defaultValues: {
			planId: "",
			memberId: "",
			paymentDate: new Date().toISOString(),
			amount: 0,
			phoneNumber: "",
		} as PaymentSchema,
		validators: {
			onSubmit: paymentSchema,
		},
		onSubmit: ({ value }) => {
			stkMutation.mutate(value);
		},
	});

	const [memberId] = useStore(form.store, (state) => [state.values.memberId]);

	const [
		{ data: activeMembership, isLoading: isLoadingPlan },
		{ data: member, isLoading: isLoadingMember },
	] = useQueries({
		queries: [
			{
				queryKey: ["member-active-plan", memberId],
				queryFn: () => getMemberPreviousPlanDetails({ data: memberId }),
				enabled: !!memberId,
				refetchOnWindowFocus: false,
			},
			memberQueries.detail(memberId),
		],
	});

	useEffect(() => {
		if (member?.contact) {
			form.setFieldValue("phoneNumber", member?.contact);
		}
	}, [member?.contact, form]);

	const isFetchingDetails = isLoadingPlan || isLoadingMember;

	const currentPlanName = activeMembership?.membershipPlan?.name || "";
	const startDate = activeMembership?.startDate
		? format(new Date(activeMembership.startDate), "PP")
		: "";
	const endDate = activeMembership?.endDate
		? format(new Date(activeMembership.endDate), "PP")
		: "";

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
			<FieldGroup className="grid lg:grid-cols-3 gap-4 relative">
				{isLoadingPlan && (
					<div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-md">
						<div className="flex items-center gap-2 bg-background border rounded-md px-4 py-2 shadow-sm">
							<Loader2 className="animate-spin h-4 w-4" />
							<span className="text-sm font-medium">Fetching plan...</span>
						</div>
					</div>
				)}
				<ReadonlyFields
					label="Current Plan"
					value={currentPlanName}
					id={generateRandomId("member")}
				/>
				<ReadonlyFields
					label="Start Date"
					value={startDate}
					id={generateRandomId("startDate")}
				/>
				<ReadonlyFields
					label="End Date"
					value={endDate}
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
				<form.AppField name="phoneNumber">
					{(field) => <field.Input label="Phone Number" required />}
				</form.AppField>
			</FieldGroup>
			{stkMutation.error && (
				<Alert variant="destructive">
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{stkMutation.error.message}</AlertDescription>
				</Alert>
			)}
			{stkMutation.data?.checkoutRequestId && (
				<Alert variant="warning">
					<AlertTitle>Payment Status</AlertTitle>
					<AlertDescription>
						{statusQuery.isLoading && "Checking payment status..."}
						{statusQuery.data && !statusQuery.data.exists && (
							<p>Payment not found (yet).</p>
						)}
						{statusQuery.data?.status}
					</AlertDescription>
				</Alert>
			)}
			<div className="flex items-center gap-4">
				<Button
					disabled={isFetchingDetails || stkMutation.isPending}
					type="submit"
					size="lg"
					className="self-end"
				>
					<CheckIcon />
					Prompt Payment
				</Button>
				<Button
					type="button"
					variant="secondary"
					size="lg"
					className="self-end"
					disabled={isFetchingDetails || stkMutation.isPending}
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
					disabled={isFetchingDetails || stkMutation.isPending}
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
