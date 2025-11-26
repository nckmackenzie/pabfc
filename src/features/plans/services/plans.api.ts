import { createServerFn } from "@tanstack/react-start";
import { asc, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { membershipPlans } from "@/drizzle/schema";
import { permissionsMiddleware } from "@/middlewares/permission-middleware";

export const getPlans = createServerFn()
	.middleware([permissionsMiddleware(["plans:view"])])
	.handler(async () => {
		return db.query.membershipPlans.findMany({
			orderBy: asc(sql`
             lower(${membershipPlans.name})   
            `),
		});
	});

// export const getActivePlans = createServerFn()
// 	.middleware([permissionsMiddleware(["plans:view"])])
// 	.handler(async () => {
// 		const allPlans = await getPlans();
// 		return allPlans
// 			.filter((plan) => plan.active)
// 			.map((plan) => ({
// 				value: plan.id,
// 				label: toTitleCase(plan.name),
// 			}));
// 	});
