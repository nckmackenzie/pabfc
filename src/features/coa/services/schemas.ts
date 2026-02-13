import { z } from "zod";
import { accountType } from "@/drizzle/schema";

export const accountsFormSchema = z
	.object({
		name: z.string().trim().min(1, { message: "Account Name is required" }),
		type: z.enum([...accountType], { error: "Select an account type" }),
		isSubcategory: z.boolean(),
		parentId: z.string().nullish(),
		description: z.string().nullish(),
		isActive: z.boolean(),
		isBankAccount: z.boolean(),
		accountNumber: z.string().nullish(),
		openingBalance: z.number().nullish(),
		openingBalanceDate: z.iso.date().nullish(),
	})
	.superRefine((data, ctx) => {
		if (data.isSubcategory && !data.parentId) {
			ctx.addIssue({
				code: "custom",
				message: "Parent Account is required for sub category",
				path: ["parentId"],
			});
		}
		if (data.isBankAccount) {
			if (!data.accountNumber || data.accountNumber.trim().length === 0) {
				ctx.addIssue({
					code: "custom",
					message: "Account Number is required",
					path: ["accountNumber"],
				});
			}
			if (
				data.openingBalance &&
				data.openingBalance > 0 &&
				!data.openingBalanceDate
			) {
				ctx.addIssue({
					code: "custom",
					message: "Opening Balance Date is required",
					path: ["openingBalanceDate"],
				});
			}
			if (
				data.openingBalanceDate &&
				new Date(data.openingBalanceDate).setHours(0, 0, 0, 0) >
					new Date().setHours(0, 0, 0, 0)
			) {
				ctx.addIssue({
					code: "custom",
					message: "Opening Balance Date cannot be in the future",
					path: ["openingBalanceDate"],
				});
			}
		}
	});

export type AccountsFormSchema = z.infer<typeof accountsFormSchema>;
