import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { type Enquiry, enquiries, members } from "@/drizzle/schema";
import { enquiryStatusLabel } from "@/features/enquiries/lib/constants";
import { isOpenStatus } from "@/features/enquiries/lib/enquiry-status";
import { enquiryFullName } from "@/features/enquiries/lib/helpers";
import { logEnquiryActivity } from "@/features/enquiries/services/enquiry-activity";
import { findEnquiryDuplicates } from "@/features/enquiries/services/enquiry-duplicates";
import {
	convertEnquirySchema,
	linkEnquiryToMemberSchema,
} from "@/features/enquiries/services/schemas";
import { insertMemberRecord } from "@/features/members/services/member-creation";
import { validateMemberUniqueness } from "@/features/members/services/member.mutations.api";
import type { MemberFormSchema } from "@/features/members/services/schemas";
import { sendRegistrationLinkEvent } from "@/features/members/services/registration-link";
import { ConflictError } from "@/lib/error-handling/app-error";
import { findUniqueViolation } from "@/lib/error-handling/pg-errors";
import { requirePermission } from "@/lib/permissions/permissions";
import { phoneMatchVariants } from "@/lib/phone";
import { failure, type Result, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";

type LockedEnquiry = { ok: true; enquiry: Enquiry } | { ok: false; result: Result<never> };

// Locks the enquiry row so two staff can't convert or link it at once, and checks
// it is still open.
async function lockOpenEnquiry(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	id: string
): Promise<LockedEnquiry> {
	const [enquiry] = await tx
		.select()
		.from(enquiries)
		.where(and(eq(enquiries.id, id), isNull(enquiries.deletedAt)))
		.for("update");

	if (!enquiry) {
		return { ok: false, result: failure({ type: "NotFoundError", message: "Enquiry not found" }) };
	}
	if (enquiry.status === "lost") {
		return {
			ok: false,
			result: failure({
				type: "ValidationError",
				message: "Reopen this lost enquiry before converting or linking it.",
			}),
		};
	}
	if (!isOpenStatus(enquiry.status)) {
		return {
			ok: false,
			result: failure({
				type: "ConflictError",
				message: `This enquiry is already ${enquiryStatusLabel(enquiry.status).toLowerCase()}.`,
			}),
		};
	}
	return { ok: true, enquiry };
}

export const convertEnquiryFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(convertEnquirySchema)
	.handler(
		async ({
			data: { enquiryId, member },
			context: {
				user: { id: userId },
			},
		}): Promise<Result<{ memberId: string }>> => {
			await requirePermission("enquiries:convert");
			await requirePermission("members:create");

			try {
				const result = await db.transaction(async (tx) => {
					const locked = await lockOpenEnquiry(tx, enquiryId);
					if (!locked.ok) return locked.result;
					const { enquiry } = locked;

					const lastName = member.lastName.trim();
					if (!lastName) {
						return failure({
							type: "ValidationError",
							message: "Last name is required to convert an enquiry to a member.",
						});
					}

					// The enquiry's canonical phone is the member's contact; the form's
					// copy is read-only and ignored here.
					const phoneMatch = (
						await findEnquiryDuplicates(tx, {
							phone: enquiry.phone,
							excludeEnquiryId: enquiry.id,
						})
					).member;
					if (phoneMatch?.deleted) {
						return failure({
							type: "ConflictError",
							message: `This number belongs to a deleted member (${phoneMatch.name}, no. ${phoneMatch.memberNo}) and cannot be reused. Ask an administrator to restore that member.`,
						});
					}
					if (phoneMatch) {
						return failure({
							type: "ConflictError",
							message: `A member with this number already exists (${phoneMatch.name}, no. ${phoneMatch.memberNo}). Link the enquiry to that member instead.`,
						});
					}

					await validateMemberUniqueness({ contact: enquiry.phone, idNumber: member.idNumber });
					if (member.email) {
						const emailTaken = await tx.query.members.findFirst({
							columns: { id: true },
							where: eq(members.email, member.email),
						});
						if (emailTaken) {
							return failure({
								type: "ConflictError",
								message: "A member with this email address already exists.",
							});
						}
					}

					const memberData: MemberFormSchema = { ...member, lastName, contact: enquiry.phone };
					const created = await insertMemberRecord({ tx, data: memberData });

					await tx
						.update(enquiries)
						.set({
							status: "registered",
							convertedMemberId: created.id,
							registeredAt: new Date(),
							// Keep the enquiry's name complete now that the member has one.
							lastName: enquiry.lastName ?? lastName,
							updatedByUserId: userId,
						})
						.where(eq(enquiries.id, enquiry.id));

					await logEnquiryActivity(tx, {
						userId,
						action: "convert enquiry to member",
						description: `Registered ${enquiryFullName(member.firstName, lastName)} (member no. ${created.memberNo}) from enquiry ${enquiry.phone}`,
					});

					return success({ memberId: created.id });
				});

				// After commit, exactly as createMember does. A send failure must not
				// undo or hide a member that is already saved.
				if (result.success) {
					try {
						await sendRegistrationLinkEvent(result.data.memberId);
					} catch (error) {
						console.error("Failed to queue registration link", error);
					}
				}

				return result;
			} catch (error) {
				if (error instanceof ConflictError) {
					return failure({
						type: "ConflictError",
						message: error.message.replace(/^DUPLICATE:/, "Cannot convert: "),
					});
				}
				if (findUniqueViolation(error)) {
					return failure({
						type: "ConflictError",
						message: "A member with this phone, email or ID number already exists.",
					});
				}
				console.error(error);
				return failure({ type: "ApplicationError", message: "Failed to convert enquiry" });
			}
		}
	);

// Links an open enquiry to a member who already exists (e.g. a lapsed member
// asking again). Always `registered`: the enquiry converts on the member's next
// completed paid payment, never retroactively from an older one.
export const linkEnquiryToMemberFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(linkEnquiryToMemberSchema)
	.handler(
		async ({
			data: { enquiryId, memberId },
			context: {
				user: { id: userId },
			},
		}): Promise<Result<{ memberId: string }>> => {
			await requirePermission("enquiries:convert");

			try {
				return await db.transaction(async (tx) => {
					const locked = await lockOpenEnquiry(tx, enquiryId);
					if (!locked.ok) return locked.result;
					const { enquiry } = locked;

					const member = await tx.query.members.findFirst({
						columns: { id: true, firstName: true, lastName: true, memberNo: true, contact: true },
						where: and(eq(members.id, memberId), isNull(members.deletedAt)),
					});
					if (!member) {
						return failure({ type: "NotFoundError", message: "Member not found" });
					}
					if (!phoneMatchVariants(enquiry.phone).includes(member.contact)) {
						return failure({
							type: "ValidationError",
							message: "That member's phone number doesn't match this enquiry.",
						});
					}

					await tx
						.update(enquiries)
						.set({
							status: "registered",
							convertedMemberId: member.id,
							registeredAt: new Date(),
							updatedByUserId: userId,
						})
						.where(eq(enquiries.id, enquiry.id));

					await logEnquiryActivity(tx, {
						userId,
						action: "link enquiry to member",
						description: `Linked enquiry for ${enquiryFullName(enquiry.firstName, enquiry.lastName)} (${enquiry.phone}) to member ${member.firstName} ${member.lastName} (no. ${member.memberNo})`,
					});

					return success({ memberId: member.id });
				});
			} catch (error) {
				console.error(error);
				return failure({ type: "ApplicationError", message: "Failed to link enquiry to member" });
			}
		}
	);
