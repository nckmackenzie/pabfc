import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { addonInvoiceLines, addonInvoices, addons, ledgerAccounts } from "@/drizzle/schema";
import { resolveAddonDeleteStrategy } from "@/features/addons/lib/helpers";
import { addonSchema } from "@/features/addons/services/schemas";
import { requireAnyPermission, requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { normalizeText, toDecimalString } from "@/lib/helpers";

export const getAddons = createServerFn()
	.middleware([authMiddleware])
	.validator((data: { active?: boolean } | undefined) => data)
	.handler(async ({ data }) => {
		await requireAnyPermission(["plans:view", "receipts:create"]);

		return db
			.select({
				id: addons.id,
				name: addons.name,
				description: addons.description,
				amount: addons.amount,
				perMember: addons.perMember,
				revenueAccountId: addons.revenueAccountId,
				revenueAccountName: ledgerAccounts.name,
				active: addons.active,
			})
			.from(addons)
			.leftJoin(ledgerAccounts, eq(addons.revenueAccountId, ledgerAccounts.id))
			.where(data?.active !== undefined ? eq(addons.active, data.active) : undefined)
			.orderBy(asc(sql`lower(${addons.name})`));
	});

export const getAddonById = createServerFn()
	.middleware([authMiddleware])
	.validator((data: string) => data)
	.handler(async ({ data: addonId }) => {
		await requireAnyPermission(["plans:view", "plans:update", "receipts:create"]);

		const addon = await db.query.addons.findFirst({
			where: eq(addons.id, addonId),
		});
		if (!addon) return null;

		// Whether any historical receipt references this addon — the edit form warns
		// (but still allows) changing the amount, since lines snapshot their own rate.
		const referenced = await db.query.addonInvoiceLines.findFirst({
			columns: { id: true },
			where: eq(addonInvoiceLines.addonId, addonId),
		});

		return { ...addon, hasInvoiceLines: !!referenced };
	});

export const getAddonInvoice = createServerFn()
	.middleware([authMiddleware])
	.validator((data: string) => data)
	.handler(async ({ data: addonInvoiceId }) => {
		await requireAnyPermission(["receipts:view"]);

		return db.query.addonInvoices.findFirst({
			where: eq(addonInvoices.id, addonInvoiceId),
			with: {
				lines: true,
				member: {
					columns: {
						firstName: true,
						lastName: true,
						image: true,
						memberNo: true,
					},
				},
			},
		});
	});

export const addonNameExists = createServerFn()
	.middleware([authMiddleware])
	.validator((data: { value: string; addonId?: string }) => data)
	.handler(async ({ data: { value, addonId } }) => {
		await requireAnyPermission(["plans:create", "plans:update"]);

		return db.query.addons.findFirst({
			columns: { id: true },
			where: and(
				eq(sql`lower(${addons.name})`, value.toLowerCase()),
				addonId ? ne(addons.id, addonId) : undefined
			),
		});
	});

export const upsertAddon = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(addonSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission(!data.id ? "plans:create" : "plans:update");

			try {
				const revenueAccount = await db.query.ledgerAccounts.findFirst({
					where: and(
						eq(ledgerAccounts.id, +data.revenueAccountId),
						eq(ledgerAccounts.isActive, true),
						eq(ledgerAccounts.isPosting, true),
						eq(ledgerAccounts.type, "revenue")
					),
				});

				if (!revenueAccount) {
					return failure({
						type: "NotFoundError",
						message: "Select a valid revenue account",
					});
				}

				if (
					await addonNameExists({
						data: { value: data.name, addonId: data.id },
					})
				) {
					return failure({
						type: "ConflictError",
						message: "Addon name already exists",
					});
				}

				await db.transaction(async (tx) => {
					await tx
						.insert(addons)
						.values({
							...data,
							description: normalizeText(data.description),
							amount: toDecimalString(data.amount),
							revenueAccountId: +data.revenueAccountId,
						})
						.onConflictDoUpdate({
							target: addons.id,
							set: {
								name: data.name,
								description: normalizeText(data.description),
								amount: toDecimalString(data.amount),
								perMember: data.perMember,
								revenueAccountId: +data.revenueAccountId,
								active: data.active,
							},
						});

					await logActivity({
						data: {
							description: `${data.id ? "Updated" : "Created"} addon ${data.name}`,
							userId,
							action: data.id ? "update addon" : "create addon",
						},
					});
				});

				return success(true);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to save addon",
				});
			}
		}
	);

export const deleteAddon = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((data: string) => data)
	.handler(
		async ({
			data: addonId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("plans:delete");

			try {
				const addon = await db.query.addons.findFirst({
					where: eq(addons.id, addonId),
				});
				if (!addon) {
					return failure({
						type: "NotFoundError",
						message: "Addon not found",
					});
				}

				// Historical invoice lines snapshot their own data, but the FK still
				// points here — soft-delete (active = false) when any exist so the
				// reference survives; hard-delete only when there are none.
				const referenced = await db.query.addonInvoiceLines.findFirst({
					columns: { id: true },
					where: eq(addonInvoiceLines.addonId, addonId),
				});

				const strategy = resolveAddonDeleteStrategy(!!referenced);

				if (strategy === "soft") {
					await db.update(addons).set({ active: false }).where(eq(addons.id, addonId));
				} else {
					await db.delete(addons).where(eq(addons.id, addonId));
				}

				await logActivity({
					data: {
						description: `${strategy === "soft" ? "Deactivated" : "Deleted"} addon ${addon.name}`,
						userId,
						action: "delete addon",
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete addon",
				});
			}
		}
	);
