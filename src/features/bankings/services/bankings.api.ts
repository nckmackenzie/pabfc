import { createServerFn } from "@tanstack/react-start";
import { asc, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { bankAccounts } from "@/drizzle/schema";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getBanks = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		return db.query.bankAccounts.findMany({
			orderBy: [asc(sql`LOWER(${bankAccounts.bankName})`)],
		});
	});
