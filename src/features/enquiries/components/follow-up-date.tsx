import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { EnquiryStatus } from "@/drizzle/schema";
import { nairobiToday } from "@/lib/nairobi-time";

// Only open enquiries have a meaningful follow-up: a lost or converted one
// never becomes "overdue".
export function FollowUpDate({
	followUpDate,
	status,
}: {
	followUpDate: string | null;
	status: EnquiryStatus;
}) {
	if (!followUpDate) return <span className="text-muted-foreground">-</span>;

	const label = format(parseISO(followUpDate), "dd MMM yyyy");
	if (status !== "new" && status !== "contacted") return <span>{label}</span>;

	const today = nairobiToday();
	if (followUpDate < today) return <Badge variant="danger">Overdue · {label}</Badge>;
	if (followUpDate === today) return <Badge variant="warning">Today</Badge>;
	return <span>{label}</span>;
}
