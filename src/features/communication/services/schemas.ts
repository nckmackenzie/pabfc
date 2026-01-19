import { z } from "zod";

export const templateFormSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, { error: "Name is required" }),
	content: z.string().min(1, { error: "Content is required" }),
	description: z.string().min(1, { error: "Description is required" }),
});

export type TemplateFormSchema = z.infer<typeof templateFormSchema>;
