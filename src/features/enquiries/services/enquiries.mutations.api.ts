import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { activityLogs, employees, enquiries } from "@/drizzle/schema";
import { enquiryStatusLabel } from "@/features/enquiries/lib/constants";
import { canTransition, isConversionStatus } from "@/features/enquiries/lib/enquiry-status";
import {
	emptyToNull,
	enquiryFullName,
	normalizeEnquiryValues,
	resolveSmsConsentAt,
} from "@/features/enquiries/lib/helpers";
import {
	type EnquiryConflictError,
	findEnquiryDuplicates,
} from "@/features/enquiries/services/enquiry-duplicates";
import {
	enquiryFormSchema,
	updateEnquiryStatusSchema,
} from "@/features/enquiries/services/schemas";
import { findUniqueViolation } from "@/lib/error-handling/pg-errors";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, type Result, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";

const OPEN_PHONE_INDEX = "uq_enquiries_open_phone";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function logEnquiryActivity(
	tx: Transaction,
	{ userId, action, description }: { userId: string; action: string; description: string }
) {
	return tx.insert(activityLogs).values({ userId, action, description });
}

function openEnquiryConflict(existing: { id: string; name: string }): Result<never> {
	const error: EnquiryConflictError = {
		type: "ConflictError",
		message: `There is already an open enquiry for this phone number (${existing.name}).`,
		existingEnquiryId: existing.id,
	};
	return { success: false, error };
}

// The partial unique index is the race-safe backstop for the checks above:
// two concurrent creates can both pass them, but only one can insert.
async function conflictFromUniqueViolation(error: unknown, phone: string | null) {
	const violation = findUniqueViolation(error);
	const hint = `${violation?.constraint ?? ""} ${violation?.detail ?? ""}`;
	if (!violation || !hint.includes(OPEN_PHONE_INDEX)) return null;

	const existing = phone ? (await findEnquiryDuplicates(db, { phone })).openEnquiry : undefined;
	return existing
		? openEnquiryConflict(existing)
		: failure({
				type: "ConflictError",
				message: "There is already an open enquiry for this phone number.",
			});
}

async function isActiveEmployee(tx: Transaction, employeeId: string) {
	const employee = await tx.query.employees.findFirst({
		columns: { id: true },
		where: and(
			eq(employees.id, employeeId),
			eq(employees.status, "active"),
			isNull(employees.deletedAt)
		),
	});
	return Boolean(employee);
}

export const upsertEnquiry = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(enquiryFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}): Promise<Result<{ id: string }>> => {
			await requirePermission(data.id ? "enquiries:update" : "enquiries:create");

			const values = normalizeEnquiryValues(data);
			const phone = values.phone;
			if (!phone) {
				return failure({
					type: "ValidationError",
					message: "Enter a valid Kenyan phone number, e.g. 0712 345 678",
				});
			}

			try {
				return await db.transaction(async (tx) => {
					const existing = data.id
						? await tx.query.enquiries.findFirst({
								where: and(eq(enquiries.id, data.id), isNull(enquiries.deletedAt)),
							})
						: undefined;
					if (data.id && !existing) {
						return failure({ type: "NotFoundError", message: "Enquiry not found" });
					}

					if (
						values.assignedEmployeeId &&
						values.assignedEmployeeId !== existing?.assignedEmployeeId &&
						!(await isActiveEmployee(tx, values.assignedEmployeeId))
					) {
						return failure({
							type: "ValidationError",
							message: "Assigned staff must be an active employee.",
						});
					}

					// Duplicates only matter when the phone is new to this enquiry.
					if (!existing || existing.phone !== phone) {
						const duplicates = await findEnquiryDuplicates(tx, {
							phone,
							excludeEnquiryId: data.id,
						});
						if (duplicates.openEnquiry) {
							return openEnquiryConflict(duplicates.openEnquiry);
						}
						if (duplicates.member && !data.acknowledgeExistingMember) {
							const { member } = duplicates;
							return failure({
								type: "ConflictError",
								message: `This number belongs to ${member.deleted ? "a deleted member" : "member"} ${member.name} (no. ${member.memberNo}). Confirm to save the enquiry anyway.`,
							});
						}
					}

					const writable = {
						...values,
						phone,
						source: data.source,
						smsConsent: data.smsConsent,
						smsConsentAt: resolveSmsConsentAt({ consent: data.smsConsent, existing }),
					};
					const name = enquiryFullName(values.firstName, values.lastName);

					if (existing) {
						await tx
							.update(enquiries)
							.set({ ...writable, updatedByUserId: userId })
							.where(eq(enquiries.id, existing.id));
						await logEnquiryActivity(tx, {
							userId,
							action: "update enquiry",
							description: `Updated enquiry for ${name} (${phone})`,
						});
						return success({ id: existing.id });
					}

					const [created] = await tx
						.insert(enquiries)
						.values({ ...writable, createdByUserId: userId, updatedByUserId: userId })
						.returning({ id: enquiries.id });
					await logEnquiryActivity(tx, {
						userId,
						action: "create enquiry",
						description: `Created enquiry for ${name} (${phone})`,
					});
					return success({ id: created.id });
				});
			} catch (error) {
				const conflict = await conflictFromUniqueViolation(error, phone);
				if (conflict) return conflict;

				console.error(error);
				return failure({
					type: "ApplicationError",
					message: `Failed to ${data.id ? "update" : "create"} enquiry`,
				});
			}
		}
	);

export const updateEnquiryStatus = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateEnquiryStatusSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}): Promise<Result<undefined>> => {
			await requirePermission("enquiries:update");

			let phone: string | null = null;
			try {
				return await db.transaction(async (tx) => {
					const existing = await tx.query.enquiries.findFirst({
						where: and(eq(enquiries.id, data.id), isNull(enquiries.deletedAt)),
					});
					if (!existing) {
						return failure({ type: "NotFoundError", message: "Enquiry not found" });
					}
					phone = existing.phone;

					if (!canTransition(existing.status, data.status)) {
						return failure({
							type: "ValidationError",
							message: `An enquiry that is ${enquiryStatusLabel(existing.status).toLowerCase()} cannot be marked ${enquiryStatusLabel(data.status).toLowerCase()}.`,
						});
					}

					const toLost = data.status === "lost";
					if (toLost && !data.lostReason) {
						return failure({ type: "ValidationError", message: "Lost reason is required" });
					}

					await tx
						.update(enquiries)
						.set({
							status: data.status,
							// Cleared when an enquiry is reopened.
							lostReason: toLost ? data.lostReason : null,
							lostReasonNotes: toLost ? emptyToNull(data.lostReasonNotes) : null,
							updatedByUserId: userId,
						})
						.where(eq(enquiries.id, existing.id));

					await logEnquiryActivity(tx, {
						userId,
						action: "update enquiry status",
						description: `Marked enquiry for ${enquiryFullName(existing.firstName, existing.lastName)} (${existing.phone}) as ${enquiryStatusLabel(data.status).toLowerCase()}${toLost ? ` (${data.lostReason})` : ""}`,
					});
					return success(undefined);
				});
			} catch (error) {
				// Reopening a lost enquiry fails if another open one took the phone.
				const conflict = await conflictFromUniqueViolation(error, phone);
				if (conflict) return conflict;

				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to update enquiry status",
				});
			}
		}
	);

export const deleteEnquiry = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.string().min(1, "Enquiry id is required"))
	.handler(
		async ({
			data: enquiryId,
			context: {
				user: { id: userId },
			},
		}): Promise<Result<undefined>> => {
			await requirePermission("enquiries:delete");

			try {
				return await db.transaction(async (tx) => {
					const existing = await tx.query.enquiries.findFirst({
						where: and(eq(enquiries.id, enquiryId), isNull(enquiries.deletedAt)),
					});
					if (!existing) {
						return failure({ type: "NotFoundError", message: "Enquiry not found" });
					}
					if (isConversionStatus(existing.status)) {
						return failure({
							type: "ConflictError",
							message: `A ${enquiryStatusLabel(existing.status).toLowerCase()} enquiry is part of a member's history and cannot be deleted.`,
						});
					}

					await tx
						.update(enquiries)
						.set({ deletedAt: new Date(), updatedByUserId: userId })
						.where(and(eq(enquiries.id, existing.id), isNull(enquiries.deletedAt)));

					await logEnquiryActivity(tx, {
						userId,
						action: "delete enquiry",
						description: `Deleted enquiry for ${enquiryFullName(existing.firstName, existing.lastName)} (${existing.phone})`,
					});
					return success(undefined);
				});
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete enquiry",
				});
			}
		}
	);
