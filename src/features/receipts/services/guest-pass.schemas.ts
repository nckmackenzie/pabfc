import { z } from "zod";
import { isValidEmail } from "@/features/members/services/schemas";

export const guestFriendSchema = z.object({
	firstName: z.string().trim().min(1, "First name is required"),
	lastName: z.string().trim().min(1, "Last name is required"),
	contact: z.string().trim().min(1, "Phone number is required").max(15),
	idType: z.string().trim().min(1, "ID type is required"),
	idNumber: z.string().trim().min(6, "Provide a valid identifier").max(20),
	gender: z.enum(["male", "female", "unspecified", "other"]).nullish(),
	dateOfBirth: z.iso.date().nullish(),
	email: z
		.string()
		.trim()
		.nullish()
		.refine((value) => !value || isValidEmail(value), "Enter a valid email address"),
});

export const issueGuestPassSchema = z.object({
	sponsorMemberId: z.string().min(1, "Sponsor is required"),
	planId: z.string().min(1, "Guest pass plan is required"),
	reference: z.string().trim().min(1, "Payment reference is required"),
	friend: guestFriendSchema,
});

export const checkGuestFriendIdentitySchema = z.object({
	contact: z.string().trim().optional(),
	idNumber: z.string().trim().optional(),
});

export type GuestFriendSchema = z.infer<typeof guestFriendSchema>;
export type IssueGuestPassSchema = z.infer<typeof issueGuestPassSchema>;
export type CheckGuestFriendIdentitySchema = z.infer<typeof checkGuestFriendIdentitySchema>;

export type GuestFriendIdentityStatus = {
	status: "new" | "reuse" | "blocked";
	matchedField?: "phone" | "idNumber";
	memberNo?: number;
	memberName?: string;
};
