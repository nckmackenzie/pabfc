export const VARIABLE_SOURCES = {
	firstName: {
		table: "members",
		field: "first_name",
		description: "Member's first name",
	},
	lastName: {
		table: "members",
		field: "last_name",
		description: "Member's last name",
	},
} as const;

export function extractVariables(template: string): string[] {
	const regex = /\{(\w+)\}/g;
	const matches = template.matchAll(regex);
	return Array.from(new Set(Array.from(matches, (m) => m[0])));
}

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
