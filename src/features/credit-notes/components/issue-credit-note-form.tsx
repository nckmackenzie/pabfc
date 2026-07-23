import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/ui/card";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ToastContent } from "@/components/ui/toast-content";
import { useIssueCreditNote } from "@/features/credit-notes/hooks/use-issue-credit-note";
import {
	getCreditableMembershipsFn,
	getCreditNoteIssuanceContextFn,
} from "@/features/credit-notes/services/credit-note.queries.api";
import {
	issueCreditNoteSchema,
	type IssueCreditNoteSchema,
} from "@/features/credit-notes/services/schemas";
import { memberQueries } from "@/features/members/services/queries";
import { useAppForm } from "@/lib/form";
import { currencyFormatter } from "@/lib/helpers";

export function IssueCreditNoteForm() {
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/app/credit-notes/new" });
	const mutation = useIssueCreditNote();
	const [submissionError, setSubmissionError] = useState<string | null>(null);
	// The member picker isn't part of the submitted payload (only membershipId is)
	// — it just filters the dependent membership dropdown below.
	const [memberId, setMemberId] = useState("");

	const { data: members = [] } = useQuery(memberQueries.activeMembers());

	const form = useAppForm({
		defaultValues: {
			membershipId: "",
			reason: "",
			amount: undefined,
		} as IssueCreditNoteSchema,
		validators: {
			onSubmit: issueCreditNoteSchema,
		},
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			mutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						setSubmissionError(result.error.message);
						return;
					}
					form.reset();
					setMemberId("");
					queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
					queryClient.invalidateQueries({ queryKey: ["members"] });
					toast.success((t) => (
						<ToastContent
							title="Credit note issued"
							t={t}
							message="Credit note has been issued successfully"
						/>
					));
					navigate({
						to: "/app/credit-notes/$creditNoteId/details",
						params: { creditNoteId: result.data.id },
					});
				},
			});
		},
	});

	const [membershipId, amount, reason] = useStore(form.store, (state) => [
		state.values.membershipId,
		state.values.amount,
		state.values.reason,
	]);

	const { data: memberships = [] } = useQuery({
		queryKey: ["creditable-memberships", memberId],
		queryFn: () => getCreditableMembershipsFn({ data: memberId }),
		enabled: memberId.trim().length > 0,
	});

	const { data: context, isFetching: isLoadingContext } = useQuery({
		queryKey: ["credit-note-issuance-context", membershipId],
		queryFn: () => getCreditNoteIssuanceContextFn({ data: membershipId }),
		enabled: membershipId.trim().length > 0,
	});

	// Default the amount field to the suggested amount whenever a new eligible
	// membership is selected — staff can still edit it afterward.
	useEffect(() => {
		if (context?.eligible) {
			form.setFieldValue("amount", Number(context.suggestedAmount));
		}
	}, [context, form]);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Issue Credit Note"
				description="End a membership early and issue the member a KES account credit for the unused portion."
			/>
			<Card className="shadow-none max-w-2xl">
				<CardContent className="space-y-4">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<FieldGroup>
							<Label htmlFor="credit-note-member">Member</Label>
							<Select
								value={memberId}
								onValueChange={(value) => {
									setMemberId(value);
									form.setFieldValue("membershipId", "");
								}}
							>
								<SelectTrigger id="credit-note-member" className="w-full">
									<SelectValue placeholder="Select a member" />
								</SelectTrigger>
								<SelectContent>
									{members.map((member) => (
										<SelectItem key={member.value} value={member.value}>
											{member.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FieldGroup>

						<FieldGroup className="mt-4">
							<form.AppField name="membershipId">
								{(field) => (
									<field.Select
										label="Membership"
										required
										disabled={!memberId}
										placeholder={memberId ? "Select a membership" : "Select a member first"}
									>
										{memberships.map((membership) => (
											<SelectItem key={membership.id} value={membership.id}>
												{membership.planName} ({membership.startDate} → {membership.endDate})
											</SelectItem>
										))}
									</field.Select>
								)}
							</form.AppField>
						</FieldGroup>

						{membershipId && !isLoadingContext && context && !context.eligible && (
							<CustomAlert
								variant="destructive"
								title="Not eligible"
								description={context.reason}
								className="mt-4"
							/>
						)}

						{context?.eligible && (
							<>
								<CustomAlert
									variant="info"
									title="Unused portion"
									description={`${context.unusedDays} unused day(s) remaining on the ${context.plan.name} plan (daily rate KES ${currencyFormatter(context.dailyRate, false)}). Suggested amount: KES ${currencyFormatter(context.suggestedAmount, false)}, capped at the amount originally charged (KES ${currencyFormatter(context.membership.priceCharged ?? "0", false)}).`}
									className="mt-4"
								/>
								<FieldGroup className="mt-4">
									<form.AppField name="amount">
										{(field) => (
											<field.Input
												label="Credit Amount (KES)"
												type="number"
												step={0.01}
												min={0}
												max={Number(context.membership.priceCharged ?? context.suggestedAmount)}
												helperText="Auto-suggested from the unused portion, editable up to the amount originally charged."
											/>
										)}
									</form.AppField>
								</FieldGroup>
							</>
						)}

						<FieldGroup className="mt-4">
							<form.AppField name="reason">
								{(field) => (
									<field.Textarea
										label="Reason"
										required
										placeholder="Why is this membership ending early? (e.g. injury)"
									/>
								)}
							</form.AppField>
						</FieldGroup>

						{context?.eligible && reason.trim().length >= 5 && (
							<CustomAlert
								variant="destructive"
								title="This cannot be undone from this form"
								description={`Submitting will end this membership today and issue a KES ${currencyFormatter(amount ?? context.suggestedAmount, false)} account credit balance to ${context.member.name}.`}
								className="mt-4"
							/>
						)}

						{submissionError && (
							<CustomAlert
								variant="destructive"
								title="Error"
								description={submissionError}
								className="mt-4"
							/>
						)}
						{mutation.error && (
							<CustomAlert
								variant="destructive"
								title="Error"
								description={mutation.error.message}
								className="mt-4"
							/>
						)}

						<div className="flex gap-3 justify-end mt-6">
							<form.AppForm>
								<form.SubmitButton
									buttonText="Issue Credit Note"
									isLoading={mutation.isPending}
									disabled={!context?.eligible}
								/>
							</form.AppForm>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
