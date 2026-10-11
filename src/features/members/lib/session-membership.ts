// "Current" session membership for a member: the active one if there is one,
// otherwise the most recently-ending one. A null endDate means open-ended, so
// it sorts after every dated endDate.
export function pickCurrentSessionMembership<T extends { status: string; endDate: string | null }>(
	memberships: T[]
): T | null {
	if (memberships.length === 0) return null;
	const active = memberships.find((membership) => membership.status === "active");
	if (active) return active;
	return [...memberships].sort((a, b) => {
		const aEnd = a.endDate ?? "9999-12-31";
		const bEnd = b.endDate ?? "9999-12-31";
		return bEnd.localeCompare(aEnd);
	})[0];
}
