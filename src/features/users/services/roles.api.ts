import { createServerFn } from "@tanstack/react-start";
import { asc } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { roles } from "@/drizzle/schema";
import { transformOptions } from "@/lib/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getActiveRoles = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		return transformOptions(
			await db.query.roles.findMany({
				columns: { id: true, name: true },
				orderBy: asc(roles.name),
			}),
		);
	});
