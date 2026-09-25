import { roundDecimal, toNumber } from "@/lib/helpers";

export type WhtScheduleRow = {
	vendor: string;
	taxPin: string | null;
	invoiceNo: string;
	invoiceDate: string;
	description: string | null;
	grossAmount: string;
	rate: string | null;
	whtAmount: string;
	certificateNo: string | null;
};

export type WhtScheduleGroup = {
	rate: number | null;
	label: string;
	rows: Array<WhtScheduleRow>;
	grossAmount: number;
	whtAmount: number;
};

export type WhtScheduleSummary = {
	groups: Array<WhtScheduleGroup>;
	grossAmount: number;
	whtAmount: number;
};

/**
 * Renders a stored rate as a heading: "5%", "7.5%", "12.25%". Trailing zeros are
 * dropped because the column is `numeric(5,2)`, so 5 arrives as "5.00".
 */
export function formatWhtRate(rate: number): string {
	return `${Number(rate.toFixed(2))}%`;
}

/**
 * Buckets a period's withholding deductions by the rate applied, since that is
 * what the KRA return is banded by. Rows arrive already ordered by rate, so the
 * grouping preserves the server's ordering.
 *
 * A row with no rate should not exist (a withheld line always stores one), but it
 * is grouped under "Unspecified rate" rather than dropped — it still has to be
 * filed, and silently losing it would understate the return.
 */
export function summariseWhtSchedule(
	rows: Array<WhtScheduleRow>,
): WhtScheduleSummary {
	const groups = new Map<string, WhtScheduleGroup>();

	for (const row of rows) {
		const rate = row.rate === null ? null : toNumber(row.rate);
		const key = rate === null ? "unspecified" : rate.toFixed(2);
		let group = groups.get(key);

		if (!group) {
			group = {
				rate,
				label: rate === null ? "Unspecified rate" : formatWhtRate(rate),
				rows: [],
				grossAmount: 0,
				whtAmount: 0,
			};
			groups.set(key, group);
		}

		group.rows.push(row);
		group.grossAmount = roundDecimal(
			group.grossAmount + toNumber(row.grossAmount),
		);
		group.whtAmount = roundDecimal(group.whtAmount + toNumber(row.whtAmount));
	}

	const grouped = [...groups.values()];

	return {
		groups: grouped,
		grossAmount: roundDecimal(
			grouped.reduce((total, group) => total + group.grossAmount, 0),
		),
		whtAmount: roundDecimal(
			grouped.reduce((total, group) => total + group.whtAmount, 0),
		),
	};
}
