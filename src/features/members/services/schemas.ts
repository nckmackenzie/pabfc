import { z } from "zod";
import { memberStatus } from "@/drizzle/schema";

export const memberValidateSearch = z.object({
	q: z.string().optional().catch(""),
	status: z
		.enum(["all", ...memberStatus])
		.optional()
		.catch("all"),
	plan: z.string().optional().catch("all"),
});

export type MemberValidateSearch = z.infer<typeof memberValidateSearch>;
