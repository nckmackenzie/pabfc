export function formatPlanOptionLabel(plan: {
	name: string;
	isSessionBased: boolean;
	sessionCount: number;
}): string {
	if (!plan.isSessionBased) return plan.name;
	return `${plan.name} (${plan.sessionCount} session${plan.sessionCount === 1 ? "" : "s"})`;
}
