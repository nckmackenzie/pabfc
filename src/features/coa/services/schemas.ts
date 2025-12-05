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
	})
	.superRefine((data, ctx) => {
		if (data.isSubcategory && !data.parentId) {
			ctx.addIssue({
				code: "custom",
				message: "Parent Account is required for sub category",
				path: ["parentId"],
			});
		}
	});

export type AccountsFormSchema = z.infer<typeof accountsFormSchema>;
