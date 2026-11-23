export type PgErrorLike = {
	code?: string;
	detail?: string;
	constraint?: string;
	cause?: unknown;
};

// Drizzle wraps driver errors, so the Postgres code may sit on `cause`.
export function findUniqueViolation(error: unknown): PgErrorLike | null {
	let current: unknown = error;
	for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
		const candidate = current as PgErrorLike;
		if (candidate.code === "23505") return candidate;
		current = candidate.cause;
	}
	return null;
}
