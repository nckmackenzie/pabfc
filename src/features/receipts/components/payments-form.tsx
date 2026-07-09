import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/ui/card";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FieldGroup } from "@/components/ui/field";
import { MultiSelectItem } from "@/components/ui/multi-select";
import { SelectItem } from "@/components/ui/select";
import { ToastContent } from "@/components/ui/toast-content";
import { getMemberPreviousPlanDetails } from "@/features/members/services/members.queries.api";
import { memberQueries } from "@/features/members/services/queries";
import { PaymentSummary } from "@/features/receipts/components/payment-summary";
import { useManualMembershipPayment } from "@/features/receipts/hooks/use-manual-membership-payment";
import { computeMembershipEndDate } from "@/features/receipts/lib/helpers";
import { type PaymentSchema, paymentSchema } from "@/features/receipts/services/schemas";
import { useAppForm } from "@/lib/form";
import { discountCalculator } from "@/lib/helpers";
import { PageHeader } from "@/components/ui/page-header";

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
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues: {
			planId: "",
			memberIds: [],
			paymentDate: format(new Date(), "yyyy-MM-dd"),
			startDate: format(new Date(), "yyyy-MM-dd"),
			numberOfPeriods: 1,
			amount: 0,
			reference: "",
			discountType: "none",
			discount: 0,
		} as PaymentSchema,
		validators: {
			onSubmit: paymentSchema,
		},
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			const selectedPlan = plans.find((plan) => plan.id === value.planId);
			const requiredMemberCount = selectedPlan?.memberCount ?? 1;
			if (value.memberIds.length !== requiredMemberCount) {
				setSubmissionError(
					`This plan requires exactly ${requiredMemberCount} member(s), but ${value.memberIds.length} were selected.`
				);
				return;
			}
			manualPaymentMutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						setSubmissionError(result.error.message);
						return;
					}
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
					});
				},
			});
		},
	});

	const [memberIds, planId, discountType, discount, numberOfPeriods, startDate, reference] =
		useStore(form.store, (state) => [
			state.values.memberIds,
			state.values.planId,
			state.values.discountType,
			state.values.discount,
			state.values.numberOfPeriods,
			state.values.startDate,
			state.values.reference,
		]);
	const isStartDateDirty = useStore(
		form.store,
		(state) => state.fieldMeta.startDate?.isDirty ?? false
	);

	// The first selected member is the billing/account-holder member — the same one
	// payments.memberId will be set to, and the one whose membership history drives
	// the "current plan" preview and the auto-suggested start date below.
	const primaryMemberId = memberIds[0] ?? "";
	const selectedPlan = plans.find((plan) => plan.id === planId);
	const requiredMemberCount = selectedPlan?.memberCount ?? 1;

	const { data: activeMembership, isLoading: isLoadingPlan } = useQuery({
		queryKey: ["member-active-plan", primaryMemberId],
		queryFn: () => getMemberPreviousPlanDetails({ data: primaryMemberId }),
		enabled: primaryMemberId.trim().length > 0,
		refetchOnWindowFocus: false,
	});

	// If a plan change lowers the required member count below what's already
	// selected, trim the extra members rather than leaving an invalid selection.
	useEffect(() => {
		if (memberIds.length > requiredMemberCount) {
			form.setFieldValue("memberIds", memberIds.slice(0, requiredMemberCount));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [requiredMemberCount]);

	const pricingSummary = useMemo(() => {
		if (!selectedPlan) return { planPrice: 0, discountAmount: 0, amountDue: 0 };
		const planPrice =
			(selectedPlan.price ?? 0) * (selectedPlan.memberCount ?? 1) * (numberOfPeriods || 1);
		const discountAmount = discountCalculator(discountType, discount ?? 0, planPrice);
		const amountDue = Math.max(0, planPrice - discountAmount);
		return { planPrice, discountAmount, amountDue };
	}, [selectedPlan, discountType, discount, numberOfPeriods]);

	useEffect(() => {
		if (form.getFieldValue("amount") !== pricingSummary.amountDue) {
			form.setFieldValue("amount", pricingSummary.amountDue);
		}
		if (discountType === "none" && (discount ?? 0) !== 0) {
			form.setFieldValue("discount", 0);
		}
	}, [pricingSummary, form, discountType, discount]);

	// Auto-suggest a start date while the user hasn't manually edited it.
	useEffect(() => {
		if (isStartDateDirty) return;
		const today = startOfDay(new Date());
		const activeEndDate = activeMembership?.endDate
			? startOfDay(parseISO(activeMembership.endDate))
			: null;
		const suggested = activeEndDate && activeEndDate >= today ? addDays(activeEndDate, 1) : today;
		// dontUpdateMeta: this is a programmatic suggestion, not a user edit — it must not
		// flip isDirty, otherwise the very first auto-suggestion would permanently disable
		// further suggestions (form.setFieldValue marks isDirty:true by default).
		form.setFieldValue("startDate", format(suggested, "yyyy-MM-dd"), { dontUpdateMeta: true });
	}, [activeMembership, isStartDateDirty, form]);

	// Switching the billing member should re-enable auto-suggestion for the new member.
	useEffect(() => {
		form.setFieldMeta("startDate", (meta) => ({ ...meta, isDirty: false }));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [primaryMemberId]);

	const newMembershipDates = useMemo(() => {
		if (!selectedPlan || !startDate) return { startDate: "", endDate: "" };
		const end = computeMembershipEndDate(startDate, selectedPlan.duration, numberOfPeriods || 1);
		return { startDate: format(parseISO(startDate), "PP"), endDate: format(end, "PP") };
	}, [selectedPlan, startDate, numberOfPeriods]);

	const currentPlanName = activeMembership?.membershipPlan?.name || "";
	const currentPeriodStart = activeMembership?.startDate
		? format(parseISO(activeMembership.startDate), "PP")
		: "";
	const currentPeriodEnd = activeMembership?.endDate
		? format(parseISO(activeMembership.endDate), "PP")
		: "";
	const memberName = memberIds
		.map((id) => members.find((m) => m.value === id)?.label)
		.filter(Boolean)
		.join(", ");
	const newPlanName = selectedPlan?.name ?? "";

	return (
		<div className="space-y-6">
			<PageHeader
				title="Record Payment"
				description="Log a membership payment and apply plan changes"
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<div className="lg:col-span-2">
						<Card className="shadow-none">
							<CardContent className="space-y-4 relative">
								{isLoadingPlan && (
									<div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-md">
										<div className="flex items-center gap-2 bg-background border rounded-md px-4 py-2 shadow-sm">
											<Loader2 className="animate-spin h-4 w-4" />
											<span className="text-sm font-medium">Fetching plan...</span>
										</div>
									</div>
								)}
								<FieldGroup className="grid lg:grid-cols-2 gap-4">
									<form.AppField name="paymentDate">
										{(field) => <field.Input label="Date" required type="date" />}
									</form.AppField>
									<form.AppField name="planId">
										{(field) => (
											<field.Select label="Plan" required placeholder="Select a plan">
												{plans.map((plan) => (
													<SelectItem key={plan.id} value={plan.id}>
														{plan.name}
														{plan.memberCount > 1 ? ` (${plan.memberCount} members)` : ""}
													</SelectItem>
												))}
											</field.Select>
										)}
									</form.AppField>
								</FieldGroup>
								<FieldGroup>
									<form.AppField name="memberIds">
										{(field) => (
											<field.MultiSelect
												label="Members"
												required
												placeholder="Select a plan, then choose member(s)"
												helperText={
													planId
														? `${memberIds.length}/${requiredMemberCount} member(s) selected — the first member selected is billed as the account holder`
														: "Select a plan first to see how many members it covers"
												}
											>
												{members.map((member) => {
													const isSelected = memberIds.includes(member.value);
													const capReached = memberIds.length >= requiredMemberCount;
													return (
														<MultiSelectItem
															key={member.value}
															value={member.value}
															disabled={!isSelected && capReached}
														>
															{member.label}
														</MultiSelectItem>
													);
												})}
											</field.MultiSelect>
										)}
									</form.AppField>
								</FieldGroup>
								<FieldGroup>
									<form.AppField name="reference">
										{(field) => <field.Input label="Payment Reference" required />}
									</form.AppField>
								</FieldGroup>

								<p className="text-xs font-medium uppercase text-muted-foreground tracking-wide pt-2">
									Plan Change
								</p>

								<FieldGroup className="grid lg:grid-cols-2 gap-4">
									<form.AppField name="discountType">
										{(field) => (
											<field.Select
												label="Discount Type"
												required
												placeholder="Select a discount type"
											>
												{DISCOUNT_TYPES.map((discount) => (
													<SelectItem key={discount.value} value={discount.value}>
														{discount.label}
													</SelectItem>
												))}
											</field.Select>
										)}
									</form.AppField>
									<form.AppField name="startDate">
										{(field) => <field.Input label="Start Date" required type="date" />}
									</form.AppField>
								</FieldGroup>
								<FieldGroup className="grid lg:grid-cols-2 gap-4">
									<form.AppField name="numberOfPeriods">
										{(field) => (
											<field.Input
												label="Number of Periods"
												required
												type="number"
												min={1}
												step={1}
											/>
										)}
									</form.AppField>
								</FieldGroup>
								<FieldGroup className="grid lg:grid-cols-2 gap-4">
									<form.AppField name="discount">
										{(field) => (
											<field.Input
												label="Discount Value"
												disabled={discountType === "none"}
												required={discountType !== "none"}
												type="number"
											/>
										)}
									</form.AppField>
								</FieldGroup>

								{submissionError && (
									<CustomAlert variant="destructive" title="Error" description={submissionError} />
								)}
								{manualPaymentMutation.error && (
									<CustomAlert
										variant="destructive"
										title="Error"
										description={manualPaymentMutation.error.message}
									/>
								)}
							</CardContent>
						</Card>
					</div>

					<div className="lg:col-span-1">
						<div className="lg:sticky lg:top-6">
							<PaymentSummary
								memberName={memberName}
								reference={reference}
								currentPlanName={currentPlanName}
								currentPeriodStart={currentPeriodStart}
								currentPeriodEnd={currentPeriodEnd}
								newPlanName={newPlanName}
								newPeriodStart={newMembershipDates.startDate}
								newPeriodEnd={newMembershipDates.endDate}
								planPrice={pricingSummary.planPrice}
								discountAmount={pricingSummary.discountAmount}
								amountDue={pricingSummary.amountDue}
							/>
						</div>
					</div>
				</div>

				<div className="flex gap-3 justify-end mt-6">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Record Payment"
							isLoading={manualPaymentMutation.isPending}
						/>
					</form.AppForm>
				</div>
			</form>
		</div>
	);
}
