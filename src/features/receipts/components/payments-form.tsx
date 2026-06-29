import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { addDays, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { CustomAlert } from "@/components/ui/custom-alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectItem } from "@/components/ui/select";
import { ToastContent } from "@/components/ui/toast-content";
import { getMemberPreviousPlanDetails } from "@/features/members/services/members.queries.api";
import { useManualMembershipPayment } from "@/features/receipts/hooks/use-manual-membership-payment";
// import { memberQueries } from "@/features/members/services/queries";
// import { usePaymentStatus } from "@/features/receipts/hooks/use-payment-status";
// import { useStkPush } from "@/features/receipts/hooks/use-stk-push";
import { type PaymentSchema, paymentSchema } from "@/features/receipts/services/schemas";
import { useAppForm } from "@/lib/form";
import { discountCalculator } from "@/lib/helpers";
import { generateRandomId } from "@/lib/utils";
import { memberQueries } from "@/features/members/services/queries";

const DISCOUNT_TYPES = [
	{ value: "none", label: "None" },
	{ value: "amount", label: "Flat" },
	{ value: "percentage", label: "Percentage" },
];

export function PaymentForm() {
	const { members: loaderMembers, plans } = getRouteApi("/app/receipts/new").useLoaderData();
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/app/receipts/new" });
	const { data: freshMembers } = useQuery(memberQueries.activeMembers());
	const members = freshMembers || loaderMembers;
	const manualPaymentMutation = useManualMembershipPayment();
	// STK push is disabled while payments are collected by an external provider.
	// const stkMutation = useStkPush();
	// const statusQuery = usePaymentStatus(
	// 	stkMutation.data?.checkoutRequestId ?? null,
	// );

	const form = useAppForm({
		defaultValues: {
			planId: "",
			memberId: "",
			paymentDate: format(new Date(), "yyyy-MM-dd"),
			amount: 0,
			reference: "",
			discountType: "none",
			discount: 0,
		} as PaymentSchema,
		validators: {
			onSubmit: paymentSchema,
		},
		onSubmit: ({ value }) => {
			manualPaymentMutation.mutate(value, {
				onSuccess: (data) => {
					form.reset();
					queryClient.invalidateQueries({ queryKey: ["receipts"] });
					queryClient.invalidateQueries({ queryKey: ["members"] });
					toast.success((t) => (
						<ToastContent
							title="Payment recorded"
							t={t}
							message="Payment has been recorded successfully"
						/>
					));
					navigate({
						to: "/app/receipts",
						search: { payment: data.paymentId },
					});
				},
			});
		},
	});

	const [memberId, planId, discountType, discount, paymentDate] = useStore(form.store, (state) => [
		state.values.memberId,
		state.values.planId,
		state.values.discountType,
		state.values.discount,
		state.values.paymentDate,
	]);

	const { data: activeMembership, isLoading: isLoadingPlan } = useQuery({
		queryKey: ["member-active-plan", memberId],
		queryFn: () => getMemberPreviousPlanDetails({ data: memberId }),
		enabled: memberId.trim().length > 0,
		refetchOnWindowFocus: false,
	});

	useEffect(() => {
		const plan = plans.find((plan) => plan.id === planId);
		if (!plan) return;

		// Calculate Amount
		const basePrice = plan.price ?? 0;
		const deduction = discountCalculator(discountType, discount ?? 0, basePrice);
		const discountedAmount = Math.max(0, basePrice - deduction);

		// Only update if value is different to avoid loops
		if (form.getFieldValue("amount") !== discountedAmount) {
			form.setFieldValue("amount", discountedAmount);
		}

		// Reset discount if type is none
		if (discountType === "none" && (discount ?? 0) !== 0) {
			form.setFieldValue("discount", 0);
		}
	}, [planId, plans, form, discountType, discount]);

	const newDates = useMemo(() => {
		const plan = plans.find((p) => p.id === planId);
		if (!plan) return { startDate: "", endDate: "" };
		const paymentStartDate = paymentDate ? new Date(paymentDate) : new Date();
		const activeEndDate = activeMembership?.endDate ? new Date(activeMembership.endDate) : null;
		const effectiveDate =
			activeEndDate && activeEndDate >= paymentStartDate
				? addDays(activeEndDate, 1)
				: paymentStartDate;
		return {
			startDate: format(effectiveDate, "PP"),
			endDate: format(addDays(effectiveDate, plan.duration), "PP"),
		};
	}, [planId, plans, paymentDate, activeMembership]);

	const currentPlanName = activeMembership?.membershipPlan?.name || "";
	const startDate = activeMembership?.startDate
		? format(new Date(activeMembership.startDate), "PP")
		: "";
	const endDate = activeMembership?.endDate ? format(new Date(activeMembership.endDate), "PP") : "";

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
						<field.Combobox label="Member" required items={members} placeholder="Select a member" />
					)}
				</form.AppField>
			</FieldGroup>
			<FieldGroup>
				{/* STK phone input is disabled while payment collection happens outside the app. */}
				{/* <form.AppField name="phoneNumber">
					{(field) => <field.Input label="Phone Number" required />}
				</form.AppField> */}
				<form.AppField name="reference">
					{(field) => <field.Input label="Payment Reference" required />}
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
				<ReadonlyFields label="Start Date" value={startDate} id={generateRandomId("startDate")} />
				<ReadonlyFields label="End Date" value={endDate} id={generateRandomId("endDate")} />
			</FieldGroup>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<form.AppField name="planId">
					{(field) => (
						<field.Select label="Plan" required placeholder="Select a plan">
							{plans.map((plan) => (
								<SelectItem key={plan.id} value={plan.id}>
									{plan.name}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<ReadonlyFields
					label="Plan Price"
					value={plans.find((plan) => plan.id === planId)?.price?.toFixed(2) ?? ""}
					id={generateRandomId("amount")}
				/>
			</FieldGroup>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<ReadonlyFields
					label="New Start Date"
					value={newDates.startDate}
					id={generateRandomId("newStartDate")}
				/>
				<ReadonlyFields
					label="New End Date"
					value={newDates.endDate}
					id={generateRandomId("newEndDate")}
				/>
			</FieldGroup>
			<FieldGroup className="grid lg:grid-cols-3 gap-4">
				<form.AppField name="discountType">
					{(field) => (
						<field.Select label="Discount Type" required placeholder="Select a discount type">
							{DISCOUNT_TYPES.map((discount) => (
								<SelectItem key={discount.value} value={discount.value}>
									{discount.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="discount">
					{(field) => (
						<field.Input
							label="Discount"
							disabled={discountType === "none"}
							required={discountType !== "none"}
							type="number"
						/>
					)}
				</form.AppField>
				<form.AppField name="amount">
					{(field) => <field.Input label="Amount" readOnly type="number" className="bg-accent" />}
				</form.AppField>
			</FieldGroup>
			<div className="max-w-lg mx-auto">
				{manualPaymentMutation.error && (
					<CustomAlert
						variant="destructive"
						title="Error"
						description={manualPaymentMutation.error.message}
					/>
				)}
				{/* STK status polling is disabled while payment collection happens outside the app. */}
				{/* {stkMutation.data?.checkoutRequestId && (
					<CustomAlert
						variant={
							statusQuery.data && !statusQuery.data.exists
								? "destructive"
								: "info"
						}
						title="Payment Status"
						description={
							statusQuery.isLoading ? (
								<div className="flex gap-2 items-center">
									<Loader2 className="animate-spin h-4 w-4" />
									<span className="text-sm">Checking payment status...</span>
								</div>
							) : statusQuery.data && !statusQuery.data.exists ? (
								<p>Payment not found (yet).</p>
							) : (
								<p className="text-sm capitalize">{statusQuery.data?.status}</p>
							)
						}
					/>
				)} */}
			</div>
			<form.AppForm>
				<form.SubmitButton
					buttonText="Record Payment"
					withReset
					isLoading={manualPaymentMutation.isPending}
				/>
			</form.AppForm>
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
			<Input id={id} value={value} className="bg-accent" readOnly />
		</Field>
	);
}
