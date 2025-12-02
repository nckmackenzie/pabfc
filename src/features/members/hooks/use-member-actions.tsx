import {
	RevokePortalAccessModal,
	ToggleActivateDeactivate,
} from "@/features/members/components/member-modals";
import { useModal } from "@/integrations/modal-provider";

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

	return {
		handleRevokePortalAccess,
		handleToggleActive,
	};
}
