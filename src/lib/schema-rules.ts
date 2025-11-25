import { z } from "zod";

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

export const reportDateRangeSchemaWithRequired = z
	.object({
		from: z.iso.date("Start date must be a valid date"),
		to: z.iso.date("End date must be a valid date"),
	})
	.superRefine((data, ctx) => {
		if (data.from && data.to && new Date(data.from) > new Date(data.to)) {
			ctx.addIssue({
				code: "custom",
				message: "Start date cannot be after end date",
				path: ["from"],
			});
		}
	});

export const reportWithClientAndDateRangeSchema = z.object({
	...reportDateRangeSchema.shape,
	clientId: z.string().optional(),
});

export const reportWithClientAndDateRangeSchemaWithRequired = z
	.object({
		from: z.iso.datetime("Start date must be a valid date"),
		to: z.iso.datetime("End date must be a valid date"),
		clientId: requiredStringSchemaEntry("Client is required"),
	})
	.superRefine((data, ctx) => {
		if (data.from && data.to && new Date(data.from) > new Date(data.to)) {
			ctx.addIssue({
				code: "custom",
				message: "Start date cannot be after end date",
				path: ["from"],
			});
		}
	});

export const validateReportWithClientAndDateRange = (
	clientId: string | undefined,
	from: string | undefined,
	to: string | undefined,
) => {
	return reportWithClientAndDateRangeSchemaWithRequired.safeParse({
		clientId,
		from,
		to,
	}).success;
};

export const searchParamsInputSchema = z.object({
	q: optionalStringSchemaEntry(),
});
