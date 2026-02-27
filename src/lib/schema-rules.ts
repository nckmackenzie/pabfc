import { z } from "zod";
import { dateFormat } from "./helpers";

export const paymentMethodSchemaEntry = () =>
	z.enum(["cash", "mpesa", "cheque", "bank"], {
		error: "Select payment method",
	});

export const paymentReferenceSchemaEntry = () =>
	z.string().trim().min(1, { message: "Reference is required" }).toLowerCase();

export const requiredStringNonLowerSchemaEntry = (message?: string) =>
	z
		.string()
		.trim()
		.min(1, { message: message || "This field is required" });

export const requiredStringSchemaEntry = (message?: string) =>
	z
		.string()
		.trim()
		.min(1, { message: message || "This field is required" })
		.toLowerCase();

export const optionalStringSchemaEntry = () => z.string().optional();
// .transform(val => val?.trim().toLowerCase());

export const optionalNumberSchemaEntry = () => z.number().optional();
export const requiredDateSchemaEntry = () =>
	z.iso.datetime({ error: "This field must be a valid date" });

export const requiredNumberSchemaEntry = (message?: string) =>
	z.coerce
		.number({ error: "This field must be a valid number" })
		.min(1, { message: message || "Field is required" })
		.refine((value) => !Number.isNaN(value) && value > 0, {
			message: "This field must be a valid number greater than 0",
		});

export const searchValidateSchema = z.object({
	q: z.string().optional().catch(""),
});

export const reportDateRangeSchema = z
	.object({
		from: z.iso.date().optional(),
		to: z.iso.date().optional(),
	})
	.superRefine((data, ctx) => {
		if (
			data.from &&
			data.to &&
			new Date(data.from).setHours(0, 0, 0, 0) >
				new Date(data.to).setHours(0, 0, 0, 0)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Start date cannot be after end date",
				path: ["from"],
			});
		}
	});

export const dateRangeWithSearchSchema = z
	.object({
		from: z.iso.date().optional().catch(dateFormat(new Date())),
		to: z.iso.date().optional().catch(dateFormat(new Date())),
		q: z.string().optional().catch(""),
	})
	.superRefine((data, ctx) => {
		if (
			data.from &&
			data.to &&
			new Date(data.from).setHours(0, 0, 0, 0) >
				new Date(data.to).setHours(0, 0, 0, 0)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Start date cannot be after end date",
				path: ["from"],
			});
		}
	});

export const dateRangeSchema = z
	.object({
		dateRange: z
			.object({
				from: z.iso.date().optional(),
				to: z.iso.date().optional(),
			})
			.optional(),
	})
	.superRefine((data, ctx) => {
		const { from, to } = data.dateRange || {};

		if ((from && !to) || (!from && to)) {
			ctx.addIssue({
				code: "custom",
				message: "Both 'from' and 'to' must be provided together",
				path: [from ? "dateRange.to" : "dateRange.from"],
			});
		}

		if (from && to && to < from) {
			ctx.addIssue({
				code: "custom",
				message: "'to' date cannot be earlier than 'from' date",
				path: ["dateRange.to"],
			});
		}
	});

export const dateRangeRequiredSchema = z
	.object({
		dateRange: z.object({
			from: z.iso
				.date({
					error: (iss) =>
						!iss.input ? "Select start date" : "Invalid start date",
				})
				.optional(),
			to: z.iso
				.date({
					error: (iss) => (!iss.input ? "Select end date" : "Invalid end date"),
				})
				.optional(),
		}),
	})
	.superRefine(({ dateRange: { from, to } }, ctx) => {
		if (!from || !to) {
			ctx.addIssue({
				code: "custom",
				message: "Both 'from' and 'to' must be provided together",
				path: ["dateRange"],
			});
			return;
		}
		if (
			new Date(to).setHours(0, 0, 0, 0) < new Date(from).setHours(0, 0, 0, 0)
		) {
			ctx.addIssue({
				code: "custom",
				message: "End date cannot be before start date",
				path: ["dateRange.to"],
			});
		}
	});

export const searchParamsInputSchema = z.object({
	q: optionalStringSchemaEntry(),
});
