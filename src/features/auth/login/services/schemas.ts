import { z } from "zod";

export const loginSchema = z.object({
	username: z.string().min(3, { error: "User name is required" }),
	password: z.string().min(8, { error: "Password is required" }),
});

export type LoginSchema = z.infer<typeof loginSchema>;
