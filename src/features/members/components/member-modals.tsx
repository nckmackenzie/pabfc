import { useQueryClient } from "@tanstack/react-query";
import CustomModal from "@/components/ui/custom-modal";
import { FieldGroup } from "@/components/ui/field";
import {
	revokePortalAccess,
	toggleActive,
} from "@/features/members/services/member.mutations.api";
import {
	type MemberRevokePortalAccessSchema,
	type MemberToggleActiveSchema,
	memberRevokePortalAccessSchema,
	memberToggleActiveSchema,
} from "@/features/members/services/schemas";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

export function RevokePortalAccessModal({
	memberId,
	memberName,
	banned,
}: {
	memberId: string;
	memberName: string;
	banned: boolean;
}) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();
	const revokeMutation = useFormMutation({
		createFn: (values: MemberRevokePortalAccessSchema) =>
			revokePortalAccess({ data: values }),
		entityName: "Member",
		queryKey: ["members", "overview", memberId],
		successMessage: {
			create: `Member ${memberName} portal access ${banned ? "restored" : "revoked"} successfully.`,
		},
		errorMessage: {
			create: `Error ${banned ? "restoring" : "revoking"} portal access for member ${memberName}.`,
		},
	});
	const form = useAppForm({
		defaultValues: {
			memberId,
			revokeReason: null,
			banned,
		} as MemberRevokePortalAccessSchema,
		validators: {
			onSubmit: memberRevokePortalAccessSchema,
		},
		onSubmit: ({ value }) => {
			revokeMutation.mutate(
				{ data: value },
				{
					onSuccess: () => {
						setClose();
						queryClient.invalidateQueries({ queryKey: ["members"] });
					},
				},
			);
		},
	});
	return (
		<CustomModal
			title={banned ? "Restore Portal Access" : "Revoke Portal Access"}
			subtitle={`${banned ? "Restore" : "Revoke"} portal access for ${toTitleCase(memberName)}?`}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					{!banned && (
						<form.AppField name="revokeReason">
							{(field) => (
								<field.Textarea
									label="Revoke Reason"
									placeholder="Enter revoke reason"
								/>
							)}
						</form.AppField>
					)}
					<form.AppForm>
						<form.SubmitButton
							withReset
							onReset={() => {
								form.reset();
								setClose();
							}}
							buttonText={banned ? "Restore" : "Revoke"}
							isLoading={revokeMutation.isPending}
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</CustomModal>
	);
}

export function ToggleActivateDeactivate({
	memberId,
	memberName,
	active,
}: {
	memberId: string;
	memberName: string;
	active: boolean;
}) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();
	const toggleActiveMutation = useFormMutation({
		createFn: (values: MemberToggleActiveSchema) =>
			toggleActive({ data: values }),
		entityName: "Member",
		queryKey: ["members", "overview", memberId],
		successMessage: {
			create: `Member ${memberName} ${active ? "activated" : "deactivated"} successfully.`,
		},
		errorMessage: {
			create: `Error ${active ? "activating" : "deactivating"} member ${memberName}.`,
		},
	});
	const form = useAppForm({
		defaultValues: {
			memberId,
			active,
		} as MemberToggleActiveSchema,
		validators: {
			onSubmit: memberToggleActiveSchema,
		},
		onSubmit: ({ value }) => {
			toggleActiveMutation.mutate(
				{ data: value },
				{
					onSuccess: () => {
						setClose();
						queryClient.invalidateQueries({ queryKey: ["members"] });
					},
				},
			);
		},
	});
	return (
		<CustomModal
			title={active ? "Deactivate Member" : "Activate Member"}
			subtitle={`${active ? "Deactivate" : "Activate"} member ${toTitleCase(memberName)}?`}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					<form.AppForm>
						<form.SubmitButton
							withReset
							onReset={() => {
								setClose();
							}}
							buttonText={active ? "Deactivate" : "Activate"}
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</CustomModal>
	);
}
