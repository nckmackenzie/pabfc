import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import type { EnquiryStatus } from "@/drizzle/schema";
import { enquiryStatusLabel } from "@/features/enquiries/lib/constants";

const STATUS_VARIANT: Record<EnquiryStatus, ComponentProps<typeof Badge>["variant"]> = {
	new: "info",
	contacted: "warning",
	registered: "secondary",
	converted: "success",
	lost: "danger",
};

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
	return <Badge variant={STATUS_VARIANT[status]}>{enquiryStatusLabel(status)}</Badge>;
}
