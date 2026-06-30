export function r2(n: number): number {
	return Math.round(n * 100) / 100;
}

export function isReportablePeriodStatus(status: string): boolean {
	return status === "paid" || status === "closed";
}
