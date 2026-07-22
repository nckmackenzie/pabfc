import { useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/ui/card";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { ToastContent } from "@/components/ui/toast-content";
import { PaymentSummary } from "@/features/receipts/components/payment-summary";
import { useUpgradePayment } from "@/features/receipts/hooks/use-upgrade-payment";
import {
	computeMembershipEndDate,
	computeSuggestedTopUpAmount,
	isEligibleUpgradePlan,
} from "@/features/receipts/lib/helpers";
import type { getUpgradeContext } from "@/features/receipts/services/payments.queries.api";
import {
	type UpgradePaymentSchema,
	upgradePaymentSchema,
} from "@/features/receipts/services/schemas";
import { useAppForm } from "@/lib/form";
import { taxCalculator } from "@/lib/helpers";
import type { VatType } from "@/drizzle/schema";

type EligibleUpgradeContext = Extract<
	Awaited<ReturnType<typeof getUpgradeContext>>,
	{ eligible: true }
>;

export function UpgradePaymentForm() {
	const { upgradeContext, plans, taxType } = getRouteApi(
		"/app/receipts/$receiptId/upgrade"
	).useLoaderData();

	if (!upgradeContext.eligible) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Upgrade Membership"
					description="Convert a member onto a pricier plan retroactively from their original start date."
				/>
				<CustomAlert
					variant="destructive"
					title="This payment cannot be upgraded"
					description={upgradeContext.reason}
				/>
			</div>
		);
	}

	return <EligibleUpgradeForm upgradeContext={upgradeContext} plans={plans} taxType={taxType} />;
}

function EligibleUpgradeForm({
	upgradeContext,
	plans,
	taxType,
}: {
	upgradeContext: EligibleUpgradeContext;
	plans: Array<{
		id: string;
		name: string;
		duration: number;
		price: number;
		memberCount: number;
		active: boolean;
	}>;
	taxType: VatType;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/app/receipts/$receiptId/upgrade" });
	const upgradeMutation = useUpgradePayment();
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const {
		payment,
		plan: currentPlan,
		coveredMembers,
		originalStartDate,
		originalEndDate,
	} = upgradeContext;

	// Only plans at least as long as the current one are sensible upgrade targets —
	// the loader already excludes the current plan and inactive plans.
	const eligiblePlans = plans.filter((plan) => isEligibleUpgradePlan(plan, currentPlan));

	const form = useAppForm({
		defaultValues: {
			originalPaymentId: payment.id,
			newPlanId: "",
			topUpAmount: 0,
			reference: "",
			upgradeDate: format(new Date(), "yyyy-MM-dd"),
			notes: "",
		} as UpgradePaymentSchema,
		validators: {
			onSubmit: upgradePaymentSchema,
		},
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			upgradeMutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						setSubmissionError(result.error.message);
						return;
					}
					queryClient.invalidateQueries({ queryKey: ["receipts"] });
					toast.success((t) => (
						<ToastContent
							t={t}
							title="Membership upgraded"
							message="The membership has been upgraded successfully."
						/>
					));
					navigate({
						to: "/app/receipts/$receiptId/details",
						params: { receiptId: result.data },
					});
				},
			});
		},
	});

	const [newPlanId, topUpAmount, reference] = useStore(form.store, (state) => [
		state.values.newPlanId,
		state.values.topUpAmount,
		state.values.reference,
	]);
	const isTopUpDirty = useStore(
		form.store,
		(state) => state.fieldMeta.topUpAmount?.isDirty ?? false
	);

	const selectedPlan = eligiblePlans.find((plan) => plan.id === newPlanId);

	// Pre-fill the suggested top-up while the staff member hasn't edited the field
	// yet — the amount is always staff-entered and editable, this is only a hint.
	useEffect(() => {
		if (isTopUpDirty || !selectedPlan) return;
		const suggested = computeSuggestedTopUpAmount({
			newPlanPrice: selectedPlan.price,
			newPlanMemberCount: selectedPlan.memberCount,
			originalNumberOfPeriods: payment.numberOfPeriods,
			originalPaymentAmount: Number(payment.amount),
		});
		form.setFieldValue("topUpAmount", suggested, { dontUpdateMeta: true });
	}, [selectedPlan, isTopUpDirty, form, payment.amount, payment.numberOfPeriods]);

	// Membership VAT preview — mirrors the server's taxCalculator(topUpAmount, taxType)
	// so the previewed total matches what upgradePaymentFn will actually charge/post.
	const topUpTax = useMemo(() => taxCalculator(topUpAmount, taxType), [topUpAmount, taxType]);

	const newMembershipDates = selectedPlan
		? {
				startDate: format(parseISO(originalStartDate), "PP"),
				endDate: format(
					computeMembershipEndDate(
						originalStartDate,
						selectedPlan.duration,
						payment.numberOfPeriods
					),
					"PP"
				),
			}
		: { startDate: "", endDate: "" };

	const memberName = coveredMembers.map((member) => member.name).join(", ");

	return (
		<div className="space-y-6">
			<PageHeader
				title="Upgrade Membership"
				description={`Convert this membership onto a pricier plan, retroactively from ${format(parseISO(originalStartDate), "PP")}.`}
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
							<CardContent className="space-y-4">
								<FieldGroup className="grid lg:grid-cols-2 gap-4">
									<form.AppField name="newPlanId">
										{(field) => (
											<field.Select
												label="New Plan"
												required
												placeholder={
													eligiblePlans.length > 0
														? "Select a plan"
														: "No sensible upgrade plans available"
												}
											>
												{eligiblePlans.map((plan) => (
													<SelectItem key={plan.id} value={plan.id}>
														{plan.name}
														{plan.memberCount > 1 ? ` (${plan.memberCount} members)` : ""}
													</SelectItem>
												))}
											</field.Select>
										)}
									</form.AppField>
									<form.AppField name="upgradeDate">
										{(field) => <field.Input label="Upgrade Date" required type="date" />}
									</form.AppField>
								</FieldGroup>
								<FieldGroup className="grid lg:grid-cols-2 gap-4">
									<form.AppField name="topUpAmount">
										{(field) => (
											<field.Input
												label="Top-up Amount"
												required
												type="number"
												min={0}
												helperText="Pre-filled with a suggested amount — edit as needed."
											/>
										)}
									</form.AppField>
									<form.AppField name="reference">
										{(field) => <field.Input label="Payment Reference" required />}
									</form.AppField>
								</FieldGroup>
								<FieldGroup>
									<form.AppField name="notes">
										{(field) => <field.Textarea label="Notes" placeholder="Optional notes" />}
									</form.AppField>
								</FieldGroup>

								{submissionError && (
									<CustomAlert variant="destructive" title="Error" description={submissionError} />
								)}
								{upgradeMutation.error && (
									<CustomAlert
										variant="destructive"
										title="Error"
										description={upgradeMutation.error.message}
									/>
								)}
							</CardContent>
						</Card>
					</div>

					<div className="lg:col-span-1">
						<div className="lg:sticky lg:top-6">
							<PaymentSummary
								mode="membership"
								memberName={memberName}
								reference={reference}
								currentPlanName={currentPlan.name}
								currentPeriodStart={format(parseISO(originalStartDate), "PP")}
								currentPeriodEnd={originalEndDate ? format(parseISO(originalEndDate), "PP") : "—"}
								newPlanName={selectedPlan?.name ?? ""}
								newPeriodStart={newMembershipDates.startDate}
								newPeriodEnd={newMembershipDates.endDate}
								planPrice={topUpAmount}
								amountDue={topUpAmount}
								taxAmount={topUpTax.taxAmount}
								membershipTotal={topUpTax.totalInclusiveTax}
							/>
						</div>
					</div>
				</div>

				<div className="flex gap-3 justify-end mt-6">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Upgrade Membership"
							isLoading={upgradeMutation.isPending}
						/>
					</form.AppForm>
				</div>
			</form>
		</div>
	);
}
