import { useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/ui/card";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { ToastContent } from "@/components/ui/toast-content";
import { GENDER, ID_TYPES } from "@/features/members/lib/constants";
import { memberQueries } from "@/features/members/services/queries";
import { mapGuestPassErrorToField } from "@/features/receipts/lib/guest-pass";
import {
	checkGuestFriendIdentityFn,
	issueGuestPassFn,
} from "@/features/receipts/services/guest-pass.api";
import { guestPassQueries } from "@/features/receipts/services/guest-pass.queries";
import {
	type GuestFriendIdentityStatus,
	type IssueGuestPassSchema,
	issueGuestPassSchema,
} from "@/features/receipts/services/guest-pass.schemas";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";
import { currencyFormatter } from "@/lib/helpers";

const defaultValues: IssueGuestPassSchema = {
	sponsorMemberId: "",
	planId: "",
	reference: "",
	friend: {
		firstName: "",
		lastName: "",
		contact: "",
		idType: "nationalId",
		idNumber: "",
		gender: "unspecified",
		dateOfBirth: null,
		email: null,
	},
};

const IDENTITY_FIELD_LABEL = { phone: "phone number", idNumber: "ID number" } as const;

export function GuestPassForm() {
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/app/receipts/guest-pass/new" });
	const { data: plans = [], isLoading: isLoadingPlans } = useQuery(
		guestPassQueries.availablePlans()
	);
	const { data: sponsors = [] } = useQuery(memberQueries.activeMembers());

	const [formError, setFormError] = useState<string | null>(null);
	const [sponsorError, setSponsorError] = useState<string | null>(null);
	const [identity, setIdentity] = useState<GuestFriendIdentityStatus>({ status: "new" });
	const [identityError, setIdentityError] = useState<{
		contact?: string;
		idNumber?: string;
	}>({});

	const issueMutation = useMutation({
		mutationKey: ["guest-pass", "issue"],
		mutationFn: (input: IssueGuestPassSchema) => issueGuestPassFn({ data: input }),
	});

	const form = useAppForm({
		defaultValues,
		validators: { onSubmit: issueGuestPassSchema },
		onSubmit: ({ value }) => {
			setFormError(null);
			setSponsorError(null);
			setIdentityError({});
			issueMutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						const message = result.error.message;
						const target = mapGuestPassErrorToField(message);
						if (target === "sponsorMemberId") setSponsorError(message);
						else if (target === "friend.contact") setIdentityError({ contact: message });
						else if (target === "friend.idNumber") setIdentityError({ idNumber: message });
						else setFormError(message);
						return;
					}
					const { paymentId, friendMemberNo } = result.data;
					form.reset();
					queryClient.invalidateQueries({ queryKey: ["receipts"] });
					queryClient.invalidateQueries({ queryKey: ["members"] });
					toast.success((t) => (
						<ToastContent
							title="Guest pass issued"
							t={t}
							message="The guest pass has been recorded successfully"
						/>
					));
					navigate({
						to: "/app/receipts/$receiptId/details",
						params: { receiptId: paymentId },
						search: { guestMemberNo: friendMemberNo },
					});
				},
			});
		},
	});

	const [planId, contact, idNumber, isDirty] = useStore(form.store, (state) => [
		state.values.planId,
		state.values.friend.contact,
		state.values.friend.idNumber,
		state.isDirty && !state.isSubmitted,
	]);
	usePreventUnsavedChanges(isDirty && !issueMutation.isPending);

	// Preselect the plan when only one is on offer.
	useEffect(() => {
		if (plans.length === 1 && !form.getFieldValue("planId")) {
			form.setFieldValue("planId", plans[0].id, { dontUpdateMeta: true });
		}
	}, [plans, form]);

	const selectedPlan = plans.find((plan) => plan.id === planId);

	const checkIdentity = async () => {
		if (!contact?.trim() && !idNumber?.trim()) {
			setIdentity({ status: "new" });
			return;
		}
		try {
			setIdentity(
				await checkGuestFriendIdentityFn({
					data: { contact: contact ?? undefined, idNumber: idNumber ?? undefined },
				})
			);
		} catch {
			// The check is advisory; the server re-validates on submit.
			setIdentity({ status: "new" });
		}
	};

	const blocked = identity.status === "blocked";
	const noPlanAvailable = !isLoadingPlans && plans.length === 0;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Issue Guest Pass"
				description="A member pays for a new person to train once during the promo"
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<Card className="shadow-none">
					<CardContent className="space-y-6">
						<section className="space-y-4">
							<p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
								Guest pass plan
							</p>
							{noPlanAvailable ? (
								<CustomAlert
									title="No guest pass plan is available today"
									description="Guest pass plans can only be sold within their availability window."
								/>
							) : (
								<form.AppField name="planId">
									{(field) => (
										<field.Select
											label="Plan"
											required
											placeholder="Select a guest pass plan"
											helperText={
												selectedPlan
													? `${currencyFormatter(selectedPlan.price)} · available ${selectedPlan.validFrom ?? "any time"} to ${selectedPlan.validTo ?? "open-ended"}`
													: undefined
											}
										>
											{plans.map((plan) => (
												<SelectItem key={plan.id} value={plan.id}>
													{plan.name} — {currencyFormatter(plan.price)}
												</SelectItem>
											))}
										</field.Select>
									)}
								</form.AppField>
							)}
						</section>

						<section className="space-y-4">
							<p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
								Sponsor
							</p>
							<FieldGroup>
								<form.AppField name="sponsorMemberId">
									{(field) => (
										<field.Combobox
											label="Sponsoring member"
											required
											placeholder="Select the paying member"
											helperText="Must be an active member with a current regular membership."
											items={sponsors}
										/>
									)}
								</form.AppField>
								{sponsorError && <FieldError errors={[{ message: sponsorError }]} />}
							</FieldGroup>
						</section>

						<section className="space-y-4">
							<p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
								Friend details
							</p>
							<FieldGroup className="grid lg:grid-cols-2 gap-4">
								<form.AppField name="friend.firstName">
									{(field) => (
										<field.Input
											label="First Name (As appears on ID/Passport)"
											placeholder="Enter first name"
											required
										/>
									)}
								</form.AppField>
								<form.AppField name="friend.lastName">
									{(field) => (
										<field.Input
											label="Last Name (As appears on ID/Passport)"
											placeholder="Enter last name"
											required
										/>
									)}
								</form.AppField>
								<div className="space-y-2">
									<form.AppField name="friend.contact">
										{(field) => (
											<field.Input
												label="Phone Number"
												placeholder="Enter phone number"
												required
												maxLength={15}
												onBlur={() => {
													field.handleBlur();
													void checkIdentity();
												}}
											/>
										)}
									</form.AppField>
									{identityError.contact && <FieldError errors={[{ message: identityError.contact }]} />}
								</div>
								<form.AppField name="friend.email">
									{(field) => <field.Input label="Email" placeholder="Enter email" type="email" />}
								</form.AppField>
								<form.AppField name="friend.idType">
									{(field) => (
										<field.Select label="ID Type" required placeholder="Select an ID type">
											{ID_TYPES.map((idType) => (
												<SelectItem key={idType.value} value={idType.value}>
													{idType.label}
												</SelectItem>
											))}
										</field.Select>
									)}
								</form.AppField>
								<div className="space-y-2">
									<form.AppField name="friend.idNumber">
										{(field) => (
											<field.Input
												label="ID Number"
												placeholder="Enter ID number"
												required
												maxLength={15}
												onBlur={() => {
													field.handleBlur();
													void checkIdentity();
												}}
											/>
										)}
									</form.AppField>
									{identityError.idNumber && <FieldError errors={[{ message: identityError.idNumber }]} />}
								</div>
								<form.AppField name="friend.gender">
									{(field) => (
										<field.Select label="Gender" placeholder="Select a gender">
											{GENDER.map((gender) => (
												<SelectItem key={gender.value} value={gender.value}>
													{gender.label}
												</SelectItem>
											))}
										</field.Select>
									)}
								</form.AppField>
								<form.AppField name="friend.dateOfBirth">
									{(field) => <field.Input label="Date of Birth" type="date" />}
								</form.AppField>
							</FieldGroup>
							{blocked && (
								<CustomAlert
									variant="destructive"
									title="Existing member"
									description={`A member with this ${IDENTITY_FIELD_LABEL[identity.matchedField ?? "phone"]} already exists (member no. ${identity.memberNo}). Guest passes are only for new people.`}
								/>
							)}
							{identity.status === "reuse" && (
								<CustomAlert
									title="Existing record will be reused"
									description={`Existing record ${identity.memberNo} from a voided guest pass will be reused.`}
								/>
							)}
						</section>

						<section className="space-y-4">
							<p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
								Payment
							</p>
							<FieldGroup className="grid lg:grid-cols-2 gap-4">
								<form.AppField name="reference">
									{(field) => <field.Input label="Payment Reference" required />}
								</form.AppField>
								<div className="space-y-1">
									<p className="text-sm font-medium">Total</p>
									<p className="text-2xl font-semibold">
										{selectedPlan ? currencyFormatter(selectedPlan.price) : "—"}
									</p>
								</div>
							</FieldGroup>
						</section>

						{formError && <CustomAlert variant="destructive" title="Error" description={formError} />}
						{issueMutation.error && (
							<CustomAlert
								variant="destructive"
								title="Error"
								description={issueMutation.error.message}
							/>
						)}
					</CardContent>
				</Card>

				<div className="flex gap-3 justify-end mt-6">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Issue Guest Pass"
							isLoading={issueMutation.isPending}
							disabled={blocked || noPlanAvailable}
						/>
					</form.AppForm>
				</div>
			</form>
		</div>
	);
}
