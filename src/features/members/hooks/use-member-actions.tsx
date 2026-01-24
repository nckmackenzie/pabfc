import CustomModal from "@/components/ui/custom-modal";
import {
	RevokePortalAccessModal,
	ToggleActivateDeactivate,
} from "@/features/members/components/member-modals";
import { SendMessageModal } from "@/features/members/components/send-message-modal";
import { useModal } from "@/integrations/modal-provider";
import { toTitleCase } from "@/lib/utils";

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

	return {
		handleRevokePortalAccess,
		handleToggleActive,
		handleSendMessage,
	};
}
