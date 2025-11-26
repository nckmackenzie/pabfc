import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Option } from "@/types/index.types";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function toTitleCase(str: string) {
	return str.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function generateRandomId(prefix: string = "id"): string {
	return `${prefix}-${Math.random().toString(36).substring(2, 15)}`;
}

export function transformOptions(
	data: Array<Record<string, string | number | Date | boolean>>,
	valueField = "id",
	labelField = "name",
): Array<Option> {
	return data.map((item) => ({
		value: item[valueField].toString(),
		label: item[labelField].toString().toUpperCase(),
	}));
}
