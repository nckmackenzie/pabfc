import { z } from "zod";

export const templateFormSchema = z.object({
	name: z.string().min(1, { error: "Name is required" }),
	content: z.string().min(1, { error: "Content is required" }),
	variables: z.array(z.string()).optional(),
	description: z.string().optional(),
});

export type TemplateFormSchema = z.infer<typeof templateFormSchema>;
