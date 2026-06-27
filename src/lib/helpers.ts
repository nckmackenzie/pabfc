/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import { format } from "date-fns";
import type z from "zod";
import type { DiscountType, VatType } from "@/drizzle/schema";
import type { SchemaValidationFailure, SchemaValidationSuccess } from "@/types/index.types";
import Big from "big.js";

type DateRangeString = { from: string; to: string };
type DateRangeDate = { from: Date; to: Date };
export type NumericValue = string | number | Big | null | undefined;

export const validateSchema = <T>(
	values: unknown,
	schema: z.ZodSchema<T>
): SchemaValidationFailure | SchemaValidationSuccess<T> => {
	const result = schema.safeParse(values);

	if (!result.success) {
		return {
			data: null,
			error: "Validation failed. Ensure all required fields are set",
		} satisfies SchemaValidationFailure;
	}

	return {
		error: null,
		data: result.data,
	} satisfies SchemaValidationSuccess<T>;
};

export const currencyFormatter = (
	value: string | number,
	isCurrency = true,
	compact?: boolean,
	replaceZeroNumbers = false
) => {
	const numberValue = typeof value === "string" ? parseFloat(value) : value;
	const formatted = new Intl.NumberFormat("en-KE", {
		style: isCurrency ? "currency" : "decimal",
		currency: "KES",
		notation: compact ? "compact" : "standard",
		compactDisplay: "short",
		maximumFractionDigits: 2,
	}).format(numberValue);

	if (!replaceZeroNumbers) {
		return formatted;
	}

	if (replaceZeroNumbers && numberValue === 0) {
		return "-";
	}

	return formatted;
};

export const dateFormat = (
	date: Date | string,
	formattingType: "regular" | "reporting" | "long" = "regular"
) => {
	if (formattingType === "reporting") {
		return format(new Date(date), "dd/MM/yyyy");
	} else if (formattingType === "long") {
		return format(new Date(date), "PPP");
	}
	return format(new Date(date), "yyyy-MM-dd");
};

export const discountCalculator = (
	discountType: DiscountType,
	discountValue: number,
	itemsTotal: number
) => {
	let discountAmount = 0;

	switch (discountType) {
		case "percentage":
			discountAmount = (itemsTotal * discountValue) / 100;
			break;
		case "amount":
			discountAmount = discountValue;
			break;
		default:
			break;
	}

	return discountAmount;
};

export const taxCalculator = (subTotal: number, taxType: VatType, taxRate = 16) => {
	switch (taxType) {
		case "none":
			return {
				amountExlusiveTax: subTotal,
				taxAmount: 0,
				totalInclusiveTax: subTotal,
			};
		case "inclusive": {
			const amountExlusiveTax = subTotal / (1 + taxRate / 100);
			return {
				amountExlusiveTax,
				taxAmount: subTotal - amountExlusiveTax,
				totalInclusiveTax: subTotal,
			};
		}
		case "exclusive": {
			const taxAmount = (subTotal * taxRate) / 100;
			return {
				amountExlusiveTax: subTotal,
				taxAmount,
				totalInclusiveTax: subTotal + taxAmount,
			};
		}
	}
};

export function internationalizePhoneNumber(phoneNumber: string, withPlus = false) {
	if (phoneNumber.startsWith("+")) {
		return phoneNumber;
	}
	if (phoneNumber.startsWith("0")) {
		return withPlus ? `+254${phoneNumber.slice(1)}` : `254${phoneNumber.slice(1)}`;
	}
	return phoneNumber;
}

export function generateFullPaymentInvoiceNo(paymentNo: number, prefix?: string, padding?: number) {
	const paddedPaymentNo = padding
		? paymentNo.toString().padStart(padding, "0")
		: paymentNo.toString();
	return `${prefix ? `${prefix.toUpperCase()}-` : ""}${paddedPaymentNo}`;
}

/**
 * Normalizes a date range by setting the 'from' date to start of day (00:00:00.000)
 * and the 'to' date to end of day (23:59:59.999)
 *
 * @param from - The start date (can be string, Date, or undefined)
 * @param to - The end date (can be string, Date, or undefined)
 * @returns Object with normalized from and to dates as ISO strings
 */
export function normalizeDateRange(
	from: string | Date,
	to: string | Date,
	returnAsDate: true
): DateRangeDate;
export function normalizeDateRange(
	from: string | Date,
	to: string | Date,
	returnAsDate?: false
): DateRangeString;
export function normalizeDateRange(
	from: string | Date,
	to: string | Date,
	returnAsDate = false
): DateRangeString | DateRangeDate {
	const processDate = (date: string | Date, type: "from" | "to") => {
		const d = new Date(date);
		if (Number.isNaN(d.getTime())) {
			throw new Error(`Invalid "${type}" date provided`);
		}
		if (type === "from") {
			d.setUTCHours(0, 0, 0, 0);
		} else {
			d.setUTCHours(23, 59, 59, 999);
		}
		return d;
	};

	const fromDate = processDate(from, "from");
	const normalizedFrom = fromDate.toISOString();

	const toDate = processDate(to, "to");
	const normalizedTo = toDate.toISOString();

	if (fromDate && toDate && fromDate > toDate) {
		throw new Error('"from" date cannot be greater than "to" date');
	}

	if (returnAsDate) {
		return {
			from: fromDate,
			to: toDate,
		};
	}

	return {
		from: normalizedFrom,
		to: normalizedTo,
	};
}

export function percentageChangeCalculator(current: number, previous: number) {
	if (previous === 0) {
		return { value: current === 0 ? 0 : 100, isPositive: current >= 0 };
	}

	const change = ((current - previous) / previous) * 100;

	return {
		value: Number.isFinite(change) ? Math.abs(Number(change.toFixed(1))) : 0,
		isPositive: change >= 0,
	};
}

export function percentage(partialValue: number, totalValue: number) {
	if (totalValue === 0) return 0;
	const value = (100 * partialValue) / totalValue;
	return Number.isFinite(value) ? value : 0;
}

export const toNumber = (value: NumericValue) => {
	return toBig(value).toNumber();
};

export function toNullableNumber(value: NumericValue): number | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	try {
		return new Big(value).toNumber();
	} catch {
		return null;
	}
}

export function toDecimalString(value: NumericValue, decimals = 2) {
	return toBig(value).round(decimals, Big.roundHalfUp).toFixed(decimals);
}

export function toDecimalNumber(value: NumericValue, decimals = 2) {
	return Number(toDecimalString(value, decimals));
}

export function toBig(value: NumericValue) {
	if (value === null || value === undefined || value === "") {
		return new Big(0);
	}

	try {
		return new Big(value);
	} catch {
		return new Big(0);
	}
}

export function roundDecimal(value: NumericValue, decimals = 2) {
	return Number(toBig(value).round(decimals, Big.roundHalfUp).toFixed(decimals));
}

export function normalizeText(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

export const seo = ({ title, description }: { title: string; description?: string }) => {
	const tags = [
		{ title: `${title} / Prime Age Beauty & Fitness Center` },
		{ name: "description", content: description },
	];

	return tags;
};
