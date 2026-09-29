import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, ilike, inArray, notInArray, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { bills, vendors, whtCorrectionLines, whtCorrections } from "@/drizzle/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getCorrectionNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const result = await db.execute<{ correctionNo: number }>(
			`SELECT COALESCE(MAX(correction_no), 0) as "correctionNo" FROM wht_corrections`,
		);
		return (result.rows[0]?.correctionNo ?? 0) + 1;
	});

/**
 * Bills a correction line can reference: any non-draft, non-cancelled bill,
 * across every vendor. Unlike the WHT remittance picker this is not scoped
 * to bills with an outstanding WHT balance — a correction targets a bill
 * that may have withheld nothing at all, which is the whole point.
 */
export const getCorrectableBills = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("wht-corrections:create");

		return db
			.select({
				id: bills.id,
				invoiceNo: bills.invoiceNo,
				invoiceDate: bills.invoiceDate,
				vendorName: vendors.name,
			})
			.from(bills)
			.innerJoin(vendors, eq(bills.vendorId, vendors.id))
			.where(notInArray(bills.status, ["draft", "cancelled"]))
			.orderBy(desc(bills.invoiceDate))
			.limit(500);
	});

/**
 * Soft duplicate-warning check: which of the given bills already has a
 * correction line on some other correction. Never blocks submission — the
 * form shows this as a banner, not a validation error.
 */
export const getExistingCorrectionsForBills = createServerFn()
	.middleware([authMiddleware])
	.validator(z.array(z.string()))
	.handler(async ({ data: billIds }) => {
		await requirePermission("wht-corrections:create");

		if (billIds.length === 0) return [];

		return db
			.select({
				billId: whtCorrectionLines.billId,
				correctionNo: whtCorrections.correctionNo,
			})
			.from(whtCorrectionLines)
			.innerJoin(
				whtCorrections,
				eq(whtCorrectionLines.correctionId, whtCorrections.id),
			)
			.where(inArray(whtCorrectionLines.billId, billIds));
	});

export const getCorrections = createServerFn()
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		await requirePermission("wht-corrections:view");

		return db
			.select({
				id: whtCorrections.id,
				correctionNo: whtCorrections.correctionNo,
				correctionDate: whtCorrections.correctionDate,
				remittanceStatus: whtCorrections.remittanceStatus,
				memo: whtCorrections.memo,
				amount: sum(whtCorrectionLines.amount),
			})
			.from(whtCorrections)
			.where(
				q
					? or(
							ilike(sql`${whtCorrections.correctionNo}::text`, `%${q}%`),
							ilike(whtCorrections.memo, `%${q}%`),
						)
					: undefined,
			)
			.leftJoin(
				whtCorrectionLines,
				eq(whtCorrections.id, whtCorrectionLines.correctionId),
			)
			.groupBy(
				whtCorrections.id,
				whtCorrections.correctionNo,
				whtCorrections.correctionDate,
				whtCorrections.remittanceStatus,
				whtCorrections.memo,
			)
			.orderBy(desc(whtCorrections.correctionNo))
			.limit(100);
	});

export const getCorrection = createServerFn()
	.middleware([authMiddleware])
	.validator(z.string().min(1, { error: "Correction id is not valid" }))
	.handler(async ({ data: correctionId }) => {
		await requirePermission("wht-corrections:view");

		const correction = await db.query.whtCorrections.findFirst({
			where: eq(whtCorrections.id, correctionId),
			with: {
				bank: { columns: { id: true, bankName: true } },
				treatmentAccount: { columns: { id: true, name: true } },
				lines: {
					orderBy: (t, { asc }) => asc(t.lineNumber),
					with: {
						bill: {
							columns: { id: true, invoiceDate: true, invoiceNo: true },
							with: {
								vendor: { columns: { id: true, name: true, taxPin: true } },
							},
						},
					},
				},
			},
		});

		if (!correction) {
			throw notFound();
		}

		return correction;
	});
