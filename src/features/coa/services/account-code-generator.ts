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

const ROOT_ACCOUNT_CODE_BASE: Record<AccountType, number> = {
	asset: 1000,
	liability: 2000,
	equity: 3000,
	revenue: 4000,
	expense: 5000,
};

const ROOT_ACCOUNT_CODE_LIMIT: Record<AccountType, number> = {
	asset: 2000,
	liability: 3000,
	equity: 4000,
	revenue: 5000,
	expense: 6000,
};

	let candidate = ROOT_ACCOUNT_CODE_BASE[params.type];
	const limit = ROOT_ACCOUNT_CODE_LIMIT[params.type];

	while (
		candidate < limit &&
		(existingNumbers.has(candidate) || allAssignedNumbers.has(candidate))
	) {
		candidate += 100;
	}

	if (candidate >= limit) {
		throw new Error(`No available root account codes remain for type "${params.type}".`);
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
