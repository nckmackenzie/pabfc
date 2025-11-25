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

export const resetPasswordFormSchema = z
	.object({
		userId: z.string().min(1, { error: "User is required" }),
		resetMethod: z.enum(["automatic", "manual"], {
			error: "Reset method is required",
		}),
		password: z.string().nullish(),
	})
	.superRefine((data, ctx) => {
		if (data.resetMethod === "manual") {
			if (!data.password || data.password.length < 8) {
				ctx.addIssue({
					code: "custom",
					message: "Password must be at least 8 characters long",
					path: ["password"],
				});
			}
		}
	});

export type UserSchema = z.infer<typeof userSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
