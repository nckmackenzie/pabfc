import { z } from "zod";
import {
	EMPLOYMENT_STATUSES,
	EMPLOYMENT_TYPES,
	gender,
} from "@/drizzle/schema";

export const employeeSchema = z
	.object({
		id: z.string().optional(),
		employeeNo: z.string().trim().min(1, {
			message: "Employee number is required",
		}),
		firstName: z.string().trim().min(1, {
			message: "First name is required",
		}),
		lastName: z.string().trim().min(1, { message: "Last name is required" }),
		gender: z.enum(gender, {
			error: (iss) =>
				!iss.input ? "Select a gender" : "Invalid gender selected",
		}),
		nationalId: z.string().trim().nullish(),
		dateOfBirth: z.iso.date().nullish(),
		emergencyContact: z.string().trim().nullish(),
		nextOfKin: z.string().trim().nullish(),
		kraPin: z.string().trim().nullish(),
		nssfNo: z.string().trim().nullish(),
		shifNo: z.string().trim().nullish(),
		helbRef: z.string().trim().nullish(),
		phone: z.string().trim().min(1, { message: "Phone number is required" }),
		email: z
			.string()
			.trim()
			.email({ message: "Invalid email address" })
			.or(z.literal(""))
			.nullish(),
		jobTitle: z.string().trim().nullish(),
		departmentId: z.number().int().positive().nullish(),
		employmentType: z.enum(EMPLOYMENT_TYPES),
		status: z.enum(EMPLOYMENT_STATUSES),
		hireDate: z.iso.date().nullish(),
		terminationDate: z.iso.date().nullish(),
		bankName: z.string().trim().nullish(),
		bankAccountNo: z.string().trim().nullish(),
		bankBranch: z.string().trim().nullish(),
		isResident: z.boolean(),
	})
	.superRefine((value, ctx) => {
		if (
			value.hireDate &&
			value.terminationDate &&
			value.terminationDate < value.hireDate
		) {
			ctx.addIssue({
				code: "custom",
				path: ["terminationDate"],
				message: "Termination date cannot be before hire date",
			});
		}
	});

export type EmployeeSchema = z.infer<typeof employeeSchema>;
