import { startTransition } from "react";
import toast from "react-hot-toast";
import CustomModal from "@/components/ui/custom-modal";
import { ToastContent } from "@/components/ui/toast-content";
import {
	RevokePortalAccessModal,
	ToggleActivateDeactivate,
} from "@/features/members/components/member-modals";
import { SendMessageModal } from "@/features/members/components/send-message-modal";
import { useModal } from "@/integrations/modal-provider";
import { toTitleCase } from "@/lib/utils";
import { sendRegistrationLink } from "../services/member.mutations.api";

export function useMemberActions() {
	const { setOpen } = useModal();

	function handleRevokePortalAccess({
		memberId,
		memberName,
		banned,
	}: {
		memberId: string;
		memberName: string;
		banned: boolean;
	}) {
		setOpen(
			<RevokePortalAccessModal
				memberId={memberId}
				memberName={memberName}
				banned={banned}
			/>,
		);
	}

	function handleToggleActive({
		memberId,
		memberName,
		active,
	}: {
		memberId: string;
		memberName: string;
		active: boolean;
	}) {
		setOpen(
			<ToggleActivateDeactivate
				memberId={memberId}
				memberName={memberName}
				active={active}
			/>,
		);
	}

	function handleSendMessage({
		memberId,
		memberName,
	}: {
		memberId: string;
		memberName: string;
	}) {
		setOpen(
			<CustomModal
				title={`Send message`}
				subtitle={`Send a message to ${toTitleCase(memberName.toLowerCase())}`}
			>
				<SendMessageModal memberId={memberId} />
			</CustomModal>,
		);
	}

	function handleSendRegistrationLink({ memberId }: { memberId: string }) {
		startTransition(() => {
			sendRegistrationLink({ data: memberId })
				.then(() =>
					toast.success((t) => (
						<ToastContent
							title="Success"
							message="Registration link sent successfully"
							t={t}
						/>
					)),
				)
				.catch(() =>
					toast.error((t) => (
						<ToastContent
							title="Error"
							message="Failed to send registration link"
							t={t}
						/>
					)),
				);
		});
	}

	return {
		handleRevokePortalAccess,
		handleToggleActive,
		handleSendMessage,
		handleSendRegistrationLink,
	};
}
