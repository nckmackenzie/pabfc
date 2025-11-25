import { z } from "zod";
import { usersType } from "@/drizzle/schema";
import { requiredStringSchemaEntry } from "@/lib/schema-rules";

export const userSchema = z
	.object({
		name: requiredStringSchemaEntry("User name is required"),
		email: z.string().nullish(),
		contact: z.string().min(1, { error: "contact is required" }),
		role: z.enum(usersType),
		roleIds: z.array(z.string()).nullish(),
		active: z.boolean(),
	})
	.superRefine((data, ctx) => {
		if (data.role !== "admin" && !data.roleIds?.length) {
			ctx.addIssue({
				code: "custom",
				message: "roles is required",
				path: ["roleIds"],
			});
		}
	});

export type UserSchema = z.infer<typeof userSchema>;
