// Kenyan mobile numbers: 9 national digits starting with 7 (Safaricom/Airtel
// et al.) or 1 (the newer 01XX ranges).
const NATIONAL_NUMBER = /^[17]\d{8}$/;

// Strips the separators staff commonly type: spaces, dashes and brackets.
function stripSeparators(input: string) {
	return input.replace(/[\s\-()[\]]/g, "");
}

function toNationalNumber(input: string): string | null {
	const cleaned = stripSeparators(input);
	if (!cleaned) return null;

	const hasPlus = cleaned.startsWith("+");
	const digits = hasPlus ? cleaned.slice(1) : cleaned;
	if (!/^\d+$/.test(digits)) return null;

	let national: string;
	if (digits.startsWith("254") && digits.length === 12) {
		national = digits.slice(3);
	} else if (hasPlus) {
		// A "+" is only valid in front of the 254 country code.
		return null;
	} else if (digits.startsWith("0") && digits.length === 10) {
		national = digits.slice(1);
	} else if (digits.length === 9) {
		national = digits;
	} else {
		return null;
	}

	return NATIONAL_NUMBER.test(national) ? national : null;
}

/**
 * Returns the canonical `+254XXXXXXXXX` form of a Kenyan mobile number, or
 * `null` when the input is not a valid one. Accepts `07…`, `01…`, `7…`, `1…`,
 * `2547…` and `+2547…` (and the `1` equivalents).
 */
export function normalizeKenyanPhone(input: string): string | null {
	const national = toNationalNumber(input);
	return national ? `+254${national}` : null;
}

/**
 * The canonical number plus the other formats a number may already be stored
 * in (`07…`, `254…`, `7…`), for matching against columns that were never
 * normalised, such as `members.contact`. Empty when the input is invalid.
 */
export function phoneMatchVariants(input: string): string[] {
	const national = toNationalNumber(input);
	if (!national) return [];
	return [`+254${national}`, `0${national}`, `254${national}`, national];
}
