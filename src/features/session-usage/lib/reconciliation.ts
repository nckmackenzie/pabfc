export type SessionMembershipInput = {
	id: string;
	memberId: string;
	startDate: string; // yyyy-MM-dd
	endDate: string; // yyyy-MM-dd
	originalEndDate: string | null; // yyyy-MM-dd, pre-truncation endDate
	status: "active" | "pending" | "expired";
	sessionsTotal: number;
};

export type UsageRowInput = {
	id: string;
	usageDate: string; // yyyy-MM-dd
	voidedAt: Date | null;
};

export type DailyAttendanceInput = {
	attendanceDate: string; // yyyy-MM-dd
	firstAttendanceLogId: bigint;
};

export type ReconciliationAction =
	| { type: "insertUsage"; usageDate: string; attendanceLogId: bigint }
	| { type: "truncateEnd"; originalEndDate: string; newEndDate: string }
	| { type: "restoreEnd"; endDate: string; reactivate: boolean }
	| { type: "overConsumption"; usageDate: string };

// Pure, DB-free: decides what reconcileOneMembership should write. Idempotent —
// feeding its own output back in (as fresh usageRows/membership state) always
// produces an empty action list.
export function planSessionReconciliation({
	membership,
	usageRows,
	dailyAttendance,
	today,
}: {
	membership: SessionMembershipInput;
	usageRows: UsageRowInput[];
	dailyAttendance: DailyAttendanceInput[];
	today: string;
}): ReconciliationAction[] {
	const actions: ReconciliationAction[] = [];
	const windowEnd = membership.originalEndDate ?? membership.endDate;
	const existingDates = new Set(usageRows.map((row) => row.usageDate));
	const nonVoided = usageRows.filter((row) => row.voidedAt === null);

	let used = nonVoided.length;
	let maxUsageDate = nonVoided.reduce<string | null>(
		(max, row) => (max === null || row.usageDate > max ? row.usageDate : max),
		null,
	);

	const eligibleDays = dailyAttendance
		.filter(
			(day) =>
				day.attendanceDate >= membership.startDate &&
				day.attendanceDate <= windowEnd &&
				!existingDates.has(day.attendanceDate),
		)
		.sort((a, b) => (a.attendanceDate < b.attendanceDate ? -1 : 1));

	for (const day of eligibleDays) {
		if (used < membership.sessionsTotal) {
			actions.push({
				type: "insertUsage",
				usageDate: day.attendanceDate,
				attendanceLogId: day.firstAttendanceLogId,
			});
			used += 1;
			if (maxUsageDate === null || day.attendanceDate > maxUsageDate) {
				maxUsageDate = day.attendanceDate;
			}
		} else {
			actions.push({ type: "overConsumption", usageDate: day.attendanceDate });
		}
	}

	if (used >= membership.sessionsTotal && maxUsageDate !== null) {
		const targetEnd = maxUsageDate < windowEnd ? maxUsageDate : windowEnd;
		if (targetEnd !== membership.endDate) {
			actions.push({
				type: "truncateEnd",
				originalEndDate: membership.originalEndDate ?? membership.endDate,
				newEndDate: targetEnd,
			});
		}
	} else if (membership.originalEndDate !== null) {
		actions.push({
			type: "restoreEnd",
			endDate: membership.originalEndDate,
			reactivate: membership.status === "expired" && membership.originalEndDate >= today,
		});
	}

	return actions;
}
