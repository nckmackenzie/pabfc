import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomAlert } from "@/components/ui/custom-alert";
import { CheckIcon } from "@/components/ui/icons";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { ENQUIRY_SOURCE_OPTIONS } from "@/features/enquiries/lib/constants";
import { isEnquiryConflictError } from "@/features/enquiries/services/enquiry-duplicates";
import { upsertEnquiry } from "@/features/enquiries/services/enquiries.mutations.api";
import type { EnquiryDetail } from "@/features/enquiries/services/enquiries.queries.api";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { type EnquiryFormSchema, enquiryFormSchema } from "@/features/enquiries/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";
import { normalizeKenyanPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

const defaultValues = {
	firstName: "",
	lastName: null,
	phone: "",
	email: null,
	source: undefined,
	sourceNotes: null,
	interestedPlanId: null,
	notes: null,
	followUpDate: null,
	assignedEmployeeId: null,
	smsConsent: false,
	acknowledgeExistingMember: false,
} as unknown as EnquiryFormSchema;

function toFormValues(enquiry: EnquiryDetail): EnquiryFormSchema {
	return {
		id: enquiry.id,
		firstName: enquiry.firstName,
		lastName: enquiry.lastName,
		phone: enquiry.phone,
		email: enquiry.email,
		source: enquiry.source,
		sourceNotes: enquiry.sourceNotes,
		interestedPlanId: enquiry.interestedPlanId,
		notes: enquiry.notes,
		followUpDate: enquiry.followUpDate,
		assignedEmployeeId: enquiry.assignedEmployeeId,
		smsConsent: enquiry.smsConsent,
		acknowledgeExistingMember: false,
	};
}

export function EnquiryForm({ enquiry }: { enquiry?: EnquiryDetail }) {
	const queryClient = useQueryClient();
	const { data: plans } = useSuspenseQuery(enquiryQueries.planOptions());
	const { data: employees } = useSuspenseQuery(enquiryQueries.assignableEmployees());

	// The phone the duplicate check last ran for; set on blur, not on every key.
	const [checkedPhone, setCheckedPhone] = useState<string | null>(null);
	// Set when the server rejects a save because an open enquiry already holds the phone.
	const [serverConflictId, setServerConflictId] = useState<string | null>(null);

	const enquiryMutation = useFormUpsert({
		upsertFn: (values: EnquiryFormSchema) => upsertEnquiry({ data: values }),
		entityName: "Enquiry",
		queryKey: [...enquiryQueries.all],
		navigateTo: "/app/enquiries",
		onReset: () => form.reset(),
		onErrorCallback: (error) => {
			if (isEnquiryConflictError(error)) {
				setServerConflictId(error.existingEnquiryId ?? null);
			}
			// A rejected save may mean the member warning has not been shown yet.
			setCheckedPhone(form.state.values.phone);
			queryClient.invalidateQueries({ queryKey: [...enquiryQueries.all, "duplicates"] });
		},
	});

	const form = useAppForm({
		defaultValues: enquiry ? toFormValues(enquiry) : defaultValues,
		validators: { onSubmit: enquiryFormSchema },
		onSubmit: ({ value }) => {
			setServerConflictId(null);
			enquiryMutation.mutate({ ...value, id: enquiry?.id });
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	usePreventUnsavedChanges(isDirty);

	const acknowledged = useStore(form.store, (state) => state.values.acknowledgeExistingMember);

	// Only worth checking when the phone is valid and differs from the saved one.
	const phoneToCheck = checkedPhone ? normalizeKenyanPhone(checkedPhone) : null;
	const { data: duplicates } = useQuery({
		...enquiryQueries.duplicates(phoneToCheck ?? "", enquiry?.id),
		enabled: Boolean(phoneToCheck) && phoneToCheck !== enquiry?.phone,
	});

	const openEnquiry = duplicates?.openEnquiry;
	const existingMember = duplicates?.member;
	const conflictEnquiryId = openEnquiry?.id ?? serverConflictId;
	const needsAcknowledgement = Boolean(existingMember) && !acknowledged;

	const planItems = plans;
	const staffItems = useMemo(() => {
		const items = employees.map(({ id, name, jobTitle }) => ({
			value: id,
			label: jobTitle ? `${name} (${jobTitle})` : name,
		}));
		// Keep a since-deactivated assignee visible instead of showing a blank.
		if (
			enquiry?.assignedEmployeeId &&
			enquiry.assignedEmployeeName &&
			!items.some((item) => item.value === enquiry.assignedEmployeeId)
		) {
			items.unshift({
				value: enquiry.assignedEmployeeId,
				label: `${enquiry.assignedEmployeeName} (inactive)`,
			});
		}
		return items;
	}, [employees, enquiry]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		e.stopPropagation();
		form.handleSubmit();
	};

	return (
		<>
			<PageHeader
				title={enquiry ? "Edit Enquiry" : "New Enquiry"}
				description={
					enquiry ? "Update the enquiry details." : "Log someone who has asked about membership."
				}
			/>
			<form onSubmit={handleSubmit} className="space-y-6 mt-6">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<form.AppField name="firstName">
						{(field) => <field.Input label="First Name" placeholder="Enter first name" required />}
					</form.AppField>
					<form.AppField name="lastName">
						{(field) => <field.Input label="Last Name" placeholder="Enter last name" />}
					</form.AppField>
					<form.AppField name="phone" listeners={{ onBlur: ({ value }) => setCheckedPhone(value) }}>
						{(field) => (
							<field.Input
								label="Phone Number"
								placeholder="e.g. 0712 345 678"
								type="tel"
								required
								helperText="Saved as +254XXXXXXXXX."
							/>
						)}
					</form.AppField>
					<form.AppField name="email">
						{(field) => <field.Input label="Email" placeholder="Enter email" type="email" />}
					</form.AppField>
				</div>

				{conflictEnquiryId && (
					<CustomAlert
						variant="destructive"
						title="An open enquiry already exists for this number"
						description={
							<span>
								{openEnquiry ? `${openEnquiry.name} is still ${openEnquiry.status}. ` : ""}
								<Link
									to="/app/enquiries/$enquiryId"
									params={{ enquiryId: conflictEnquiryId }}
									className="font-medium underline"
								>
									Open the existing enquiry
								</Link>{" "}
								instead of creating a duplicate.
							</span>
						}
					/>
				)}

				{existingMember && (
					<div className="space-y-3">
						<CustomAlert
							variant="warning"
							title={
								existingMember.deleted
									? "Phone matches a deleted member"
									: "Phone matches an existing member"
							}
							description={`${existingMember.name} (member no. ${existingMember.memberNo}) already uses this number. This is fine for a lapsed member who is asking again; confirm to save.`}
						/>
						<form.AppField name="acknowledgeExistingMember">
							{(field) => (
								<field.Checkbox label="I know this number belongs to an existing member and still want to log an enquiry" />
							)}
						</form.AppField>
					</div>
				)}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<form.AppField name="source">
						{(field) => (
							<field.Select label="Source" placeholder="How did they find us?" required>
								{ENQUIRY_SOURCE_OPTIONS.map((source) => (
									<SelectItem key={source.value} value={source.value}>
										{source.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="sourceNotes">
						{(field) => (
							<field.Input
								label="Source Notes"
								placeholder="e.g. who referred them"
								maxLength={255}
							/>
						)}
					</form.AppField>
					<form.AppField name="interestedPlanId">
						{(field) => (
							<field.Combobox
								label="Interested Plan"
								placeholder="Select a plan"
								items={planItems}
							/>
						)}
					</form.AppField>
					<form.AppField name="assignedEmployeeId">
						{(field) => (
							<field.Combobox
								label="Assigned Staff"
								placeholder="Select a staff member"
								items={staffItems}
							/>
						)}
					</form.AppField>
					<form.AppField name="followUpDate">
						{(field) => <field.Input label="Follow-up Date" type="date" />}
					</form.AppField>
				</div>

				<form.AppField name="notes">
					{(field) => (
						<field.Textarea
							className="resize-none"
							label="Notes"
							placeholder="What did they ask about?"
						/>
					)}
				</form.AppField>

				<form.AppField name="smsConsent">
					{(field) => (
						<field.Checkbox
							label="Agreed to receive SMS"
							helperText="Tick only if they said we may text them about membership."
						/>
					)}
				</form.AppField>

				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<div className={cn("flex items-center justify-end gap-2")}>
							<Button type="button" variant="outline" asChild>
								<Link to="/app/enquiries">Cancel</Link>
							</Button>
							<Button
								type="submit"
								disabled={
									isSubmitting ||
									enquiryMutation.isPending ||
									Boolean(openEnquiry) ||
									needsAcknowledgement
								}
							>
								<LoadingSwap isLoading={isSubmitting || enquiryMutation.isPending}>
									<CheckIcon />
									{enquiry ? "Update" : "Save Enquiry"}
								</LoadingSwap>
							</Button>
						</div>
					)}
				</form.Subscribe>
			</form>
		</>
	);
}
