import { z } from "zod";

export const settingsSchema = z.object({
	settings: z.object({
		logRetentionDays: z.number().nullish(),
	}),
});

export type SettingsSchema = z.infer<typeof settingsSchema>;
