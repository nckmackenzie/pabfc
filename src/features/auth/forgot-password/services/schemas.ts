import { z } from "zod";

export const requestTemporaryPasswordResetSchema = z.object({
	identifier: z
		.string()
		.min(3, { error: "Enter your phone number, username, or email" }),
});

export const completeTemporaryPasswordResetSchema = z
	.object({
		identifier: z
			.string()
			.min(3, { error: "Enter your phone number, username, or email" }),
		temporaryPassword: z
			.string()
			.min(1, { error: "Temporary password is required" }),
		newPassword: z
			.string()
			.min(8, { error: "Password must be at least 8 characters" }),
		confirmPassword: z
			.string()
			.min(8, { error: "Password must be at least 8 characters" }),
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

export type RequestTemporaryPasswordResetSchema = z.infer<
	typeof requestTemporaryPasswordResetSchema
>;

export type CompleteTemporaryPasswordResetSchema = z.infer<
	typeof completeTemporaryPasswordResetSchema
>;
