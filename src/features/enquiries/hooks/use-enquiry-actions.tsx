import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import toast from "react-hot-toast";
import CustomModal from "@/components/ui/custom-modal";
import { ToastContent } from "@/components/ui/toast-content";
import { MarkLostModal } from "@/features/enquiries/components/mark-lost-modal";
import { isEnquiryConflictError } from "@/features/enquiries/services/enquiry-duplicates";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { updateEnquiryStatus } from "@/features/enquiries/services/enquiries.mutations.api";
import { useModal } from "@/integrations/modal-provider";

// Status actions shared by the list rows and the detail page.
export function useEnquiryActions() {
	const { setOpen } = useModal();
	const queryClient = useQueryClient();

	async function changeStatus(enquiryId: string, status: "contacted", successMessage: string) {
		try {
			const result = await updateEnquiryStatus({ data: { id: enquiryId, status } });
			if (!result.success) {
				const { error } = result;
				// Reopening can collide with another open enquiry for the same phone.
				const existingEnquiryId = isEnquiryConflictError(error) ? error.existingEnquiryId : null;
				toast.error(
					(t) => (
						<div className="space-y-1">
							<ToastContent t={t} title="Error" message={error.message} />
							{existingEnquiryId && (
								<Link
									to="/app/enquiries/$enquiryId"
									params={{ enquiryId: existingEnquiryId }}
									onClick={() => toast.dismiss(t.id)}
									className="ml-3 block text-sm font-medium underline"
								>
									View the existing enquiry
								</Link>
							)}
						</div>
					),
					{ duration: existingEnquiryId ? 10000 : undefined }
				);
				return;
			}
			toast.success((t) => <ToastContent t={t} title="Success" message={successMessage} />);
			await queryClient.invalidateQueries({ queryKey: enquiryQueries.all });
		} catch (error) {
			toast.error((t) => (
				<ToastContent
					t={t}
					title="Error"
					message={error instanceof Error ? error.message : "Failed to update enquiry"}
				/>
			));
		}
	}

	function handleMarkContacted(enquiryId: string) {
		return changeStatus(enquiryId, "contacted", "Enquiry marked as contacted.");
	}

	// Reopening a lost enquiry is also a move to "contacted".
	function handleReopen(enquiryId: string) {
		return changeStatus(enquiryId, "contacted", "Enquiry reopened.");
	}

	function handleMarkLost({ enquiryId, enquiryName }: { enquiryId: string; enquiryName: string }) {
		setOpen(
			<CustomModal title="Mark as lost" subtitle={`Why did we lose ${enquiryName}?`}>
				<MarkLostModal enquiryId={enquiryId} />
			</CustomModal>
		);
	}

	return { handleMarkContacted, handleReopen, handleMarkLost };
}
