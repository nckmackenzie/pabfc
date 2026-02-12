import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { bills, vendors } from "@/drizzle/schema";
import { supplierSchema } from "@/features/bills/services/schemas";
import { ConflictError } from "@/lib/error-handling/app-error";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

export const getVendors = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		return db.query.vendors.findMany({
			where: q
				? or(
						ilike(vendors.name, `%${q}%`),
						ilike(vendors.email, `%${q}%`),
						ilike(vendors.phone, `%${q}%`),
						ilike(vendors.address, `%${q}%`),
					)
				: undefined,
			orderBy: asc(sql`lower(${vendors.name})`),
		});
	});

export const getVendorById = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(z.string())
	.handler(async ({ data: id }) => {
		const vendor = await db.query.vendors.findFirst({
			where: eq(vendors.id, id),
		});
		if (!vendor) throw notFound();
		return vendor;
	});

export const upsertSupplier = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(supplierSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			const { id, ...rest } = data;
			if (id) {
				await db.update(vendors).set(rest).where(eq(vendors.id, id));
			} else {
				await db.insert(vendors).values(rest);
			}

			await logActivity({
				data: {
					action: id ? "update" : "create",
					description: `${id ? "Updated" : "Created"} supplier ${rest.name.toLowerCase()}`,
					userId,
				},
			});
		},
	);

export const deleteSupplier = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(z.string())
	.handler(async ({ data: id }) => {
		const [vendor, bill] = await Promise.all([
			db.query.vendors.findFirst({
				columns: { name: true },
				where: eq(vendors.id, id),
			}),
			db.query.bills.findFirst({
				columns: { id: true },
				where: eq(bills.vendorId, id),
			}),
		]);
		if (!vendor) throw notFound();

		if (bill) throw new ConflictError("Supplier");

		await db.delete(vendors).where(eq(vendors.id, id));
	});
