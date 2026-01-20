import type { BroadcastFormSchema } from "@/features/communication/services/schemas";
import type { Option } from "@/types/index.types";

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

export async function getMembers(
	filterCriteria: BroadcastFormSchema["filterCriteria"],
	criteria: BroadcastFormSchema["criteria"],
): Promise<Array<Option>> {
	const urlSearchParams = new URLSearchParams();
	urlSearchParams.append("filterCriteria", filterCriteria);
	urlSearchParams.append("criteria", criteria);
	console.log(urlSearchParams.toString());
	const res = await fetch(`/api/communications/get-members?${urlSearchParams}`);
	if (!res.ok) {
		throw new Error("Failed to get members");
	}
	return res.json();
}
