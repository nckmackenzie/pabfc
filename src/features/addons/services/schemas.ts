import { optionalStringSchemaEntry, requiredStringSchemaEntry } from "@/lib/schema-rules";
import { z } from "zod";

export const addonSchema = z.object({
	id: z.string().optional(),
	name: requiredStringSchemaEntry("Name is required"),
	description: optionalStringSchemaEntry(),
	amount: z.number().min(0.01, "Rate per period must be greater than 0"),
	perMember: z.boolean(),
	revenueAccountId: z
		.string({ error: "Revenue account is required" })
		.min(1, "Revenue account is required"),
	active: z.boolean(),
});

export type AddonSchema = z.infer<typeof addonSchema>;
