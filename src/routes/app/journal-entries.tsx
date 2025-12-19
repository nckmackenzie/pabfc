import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { JournalEntryForm } from "@/features/journal-entries/components/journal-form";

export const Route = createFileRoute("/app/journal-entries")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Journal Entries / Prime Age Beauty & Fitness Center" }],
	}),
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper permissions={["journal-entries:create"]}>
			<JournalEntryForm />
		</ProtectedPageWithWrapper>
	);
}
