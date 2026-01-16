import { z } from "zod";

export const attachmentSchema = z.object({
	url: z.string().min(1),
	filename: z.string().min(1),
	mimeType: z.string().min(1),
});

export const profileDetailsSchema = z.object({
	name: z.string().min(1, { error: "Name is required" }),
	email: z.string().email().nullish(),
	contact: z.string().min(1, { error: "Contact is required" }),
	image: z.array(attachmentSchema).nullish(),
});

export const profileSecuritySchema = z
	.object({
		currentPassword: z
			.string()
			.min(1, { error: "Current password is required" }),
		newPassword: z
			.string()
			.min(8, { error: "Password must be at least 8 characters" }),
		confirmPassword: z
			.string()
			.min(8, { error: "Confirm password is required" }),
	})
	.superRefine((data, ctx) => {
		if (data.newPassword !== data.confirmPassword) {
			ctx.addIssue({
				code: "custom",
				message: "Passwords do not match",
				path: ["confirmPassword"],
			});
		}
	});

export type ProfileDetailsSchema = z.infer<typeof profileDetailsSchema>;
export type ProfileSecuritySchema = z.infer<typeof profileSecuritySchema>;
