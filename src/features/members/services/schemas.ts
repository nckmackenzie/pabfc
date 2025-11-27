import { z } from "zod";
import { memberStatus } from "@/drizzle/schema";

export function isValidEmail(email: string) {
	const emailRegex =
		/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return emailRegex.test(email);
}

export const memberValidateSearch = z.object({
	q: z.string().optional().catch(""),
	status: z
		.enum(["all", ...memberStatus])
		.optional()
		.catch("all"),
	plan: z.string().optional().catch("all"),
});

export const memberFormSchema = z
	.object({
		firstName: z.string().min(1, { error: "First name is required" }),
		lastName: z.string().min(1, "Last name is required"),
		dateOfBirth: z.date().nullish(),
		gender: z.enum(["male", "female", "unspecified", "other"]).nullish(),
		email: z.string().nullish(),
		contact: z.string().min(1, "Contact is required"),
		idType: z.string().nullish(),
		idNumber: z.string().nullish(),
		memberStatus: z.enum(memberStatus, { error: "Status is required" }),
		address: z.string().nullish(),
		emergencyContactName: z.string().nullish(),
		emergencyContactNo: z.string().nullish(),
		emergencyContactRelationship: z.string().nullish(),
		notes: z.string().nullish(),
	})
	.superRefine((data, ctx) => {
		if (data.email && !isValidEmail(data.email)) {
			ctx.addIssue({
				code: "custom",
				message: "Enter a valid email address",
				path: ["email"],
			});
		}
		if (data.idType && data.idNumber && data.idNumber.length < 6) {
			ctx.addIssue({
				code: "custom",
				message: "Provide a valid identifier",
				path: ["idNumber"],
			});
		}
		if (data.emergencyContactName && data.emergencyContactNo) {
			ctx.addIssue({
				code: "custom",
				message: "Provide a valid emergency contact",
				path: ["emergencyContactNo"],
			});
		}
	});

export type MemberValidateSearch = z.infer<typeof memberValidateSearch>;
export type MemberFormSchema = z.infer<typeof memberFormSchema>;
