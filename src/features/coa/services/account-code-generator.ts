import type { AccountType } from "@/drizzle/schema";

const ROOT_ACCOUNT_CODE_BASE: Record<AccountType, number> = {
	asset: 1000,
	liability: 2000,
	equity: 3000,
	revenue: 4000,
	expense: 5000,
};

function toCodeNumber(code: string | null | undefined) {
	if (!code) return null;

	const trimmed = code.trim();

	if (!/^\d+$/.test(trimmed)) {
		return null;
	}

	return Number(trimmed);
}

export function getNextRootAccountCode(params: {
	type: AccountType;
	existingCodes: Array<string | null>;
	allAssignedCodes: Array<string | null>;
}) {
	const existingNumbers = new Set(
		params.existingCodes
			.map(toCodeNumber)
			.filter((value): value is number => value !== null),
	);
	const allAssignedNumbers = new Set(
		params.allAssignedCodes
			.map(toCodeNumber)
			.filter((value): value is number => value !== null),
	);

	let candidate = ROOT_ACCOUNT_CODE_BASE[params.type];

	while (existingNumbers.has(candidate) || allAssignedNumbers.has(candidate)) {
		candidate += 100;
	}

	return candidate.toString();
}

export function getNextChildAccountCode(params: {
	parentCode: string | null;
	siblingCodes: Array<string | null>;
	allAssignedCodes: Array<string | null>;
}) {
	const siblingNumbers = params.siblingCodes
		.map(toCodeNumber)
		.filter((value): value is number => value !== null)
		.sort((left, right) => left - right);
	const allAssignedNumbers = new Set(
		params.allAssignedCodes
			.map(toCodeNumber)
			.filter((value): value is number => value !== null),
	);

	let candidate: number;

	if (siblingNumbers.length > 0) {
		candidate = siblingNumbers[siblingNumbers.length - 1] + 1;
		while (allAssignedNumbers.has(candidate)) {
			candidate += 1;
		}
		return candidate.toString();
	}

	const parentCodeNumber = toCodeNumber(params.parentCode);

	if (parentCodeNumber === null) {
		throw new Error("Parent account code is required to generate a child account code.");
	}

	candidate = parentCodeNumber + 1;
	while (allAssignedNumbers.has(candidate)) {
		candidate += 1;
	}

	return candidate.toString();
}
