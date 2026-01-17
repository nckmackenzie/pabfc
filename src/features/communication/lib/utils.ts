export const VARIABLE_SOURCES = {
	firstName: { table: "members", field: "first_name" },
	lastName: { table: "members", field: "last_name" },
	fullName: { table: "members", field: "full_name" },
	phoneNumber: { table: "members", field: "contact" },
	planName: { table: "plans", field: "name" },
	amount: { table: "payments", field: "amount" },
	date: { table: "system", field: "current_date" },
} as const;

export function replaceVariables(
	template: string,
	data: Record<string, string | number>,
): string {
	let result = template;

	Object.entries(data).forEach(([key, value]) => {
		const placeholder = `{${key}}`;
		result = result.replaceAll(placeholder, String(value));
	});

	return result;
}
