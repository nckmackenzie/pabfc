import { createServerFn } from "@tanstack/react-start";
import { arrayContains, asc, desc, and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { enquiries, smsBroadcasts, smsTemplates } from "@/drizzle/schema";
import { logEnquiryActivity } from "@/features/enquiries/services/enquiry-activity";
import {
	type EnquirySmsInput,
	resolveEnquiryRecipients,
	summarizeEnquirySmsFilters,
} from "@/features/enquiries/services/enquiry-sms";
import {
	enquirySmsRecipientsSchema,
	sendEnquirySmsSchema,
} from "@/features/enquiries/services/schemas";
import { inngest } from "@/lib/inngest/client";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, type Result, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const previewEnquirySmsRecipients = createServerFn()
	.middleware([authMiddleware])
	.validator(enquirySmsRecipientsSchema)
	.handler(async ({ data }) => {
		await requirePermission("enquiries:send-sms");

		const { eligible, excluded } = await resolveEnquiryRecipients(db, data as EnquirySmsInput);
		const excludedTotal =
			excluded.noConsent + excluded.ineligibleStatus + excluded.invalidPhone + excluded.notFound;

		return {
			eligibleCount: eligible.length,
			excluded,
			total: eligible.length + excludedTotal,
		};
	});

export type EnquirySmsPreview = Awaited<ReturnType<typeof previewEnquirySmsRecipients>>;

export const sendEnquirySms = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(sendEnquirySmsSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}): Promise<Result<{ broadcastId: string; recipientCount: number }>> => {
			await requirePermission("enquiries:send-sms");

			try {
				// Never trust client-sent IDs alone: consent, deletion and status are
				// re-checked here, and again when the messages are actually sent.
				const { eligible, excluded } = await resolveEnquiryRecipients(db, data as EnquirySmsInput);
				if (eligible.length === 0) {
					return failure({
						type: "ValidationError",
						message: `No one can be texted: ${excluded.noConsent} without SMS consent, ${excluded.ineligibleStatus} already converted, ${excluded.invalidPhone} with an invalid phone number.`,
					});
				}

				const byIds = Boolean(data.enquiryIds);
				const broadcastId = await db.transaction(async (tx) => {
					const [broadcast] = await tx
						.insert(smsBroadcasts)
						.values({
							filterCriteria: byIds ? "specific enquiries" : "filtered enquiries",
							recipientType: "enquiries",
							recipientFilter: byIds ? null : summarizeEnquirySmsFilters(data.filters ?? {}),
							smsTemplateId: data.smsTemplateId || null,
							content: data.content,
							receipients: eligible.map(({ id }) => id),
							smsBroadcastStatus: "sending",
							sentAt: new Date(),
						})
						.returning({ id: smsBroadcasts.id });

					await logEnquiryActivity(tx, {
						userId,
						action: "send enquiry sms",
						description: `Sent an SMS to ${eligible.length} enquirer${eligible.length === 1 ? "" : "s"} (${byIds ? "selected" : "filtered list"})`,
					});
					return broadcast.id;
				});

				try {
					await inngest.send({
						name: "app/communications.send-sms-broadcast",
						data: { broadcastId },
					});
				} catch (error) {
					console.error("Failed to queue enquiry SMS broadcast", error);
					await db
						.update(smsBroadcasts)
						.set({ smsBroadcastStatus: "failed" })
						.where(eq(smsBroadcasts.id, broadcastId));
					return failure({ type: "ApplicationError", message: "Failed to queue the messages" });
				}

				return success({ broadcastId, recipientCount: eligible.length });
			} catch (error) {
				console.error(error);
				return failure({ type: "ApplicationError", message: "Failed to send message" });
			}
		}
	);

// Scoped to enquiries:send-sms: getSmsTemplates needs communication permissions,
// which staff who only text enquirers won't have.
export const getEnquirySmsTemplates = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("enquiries:send-sms");
		return db
			.select({ id: smsTemplates.id, name: smsTemplates.name, content: smsTemplates.content })
			.from(smsTemplates)
			.orderBy(asc(smsTemplates.name));
	});

// The last 10 broadcasts that included this enquiry, newest first, with this
// enquiry's own delivery result matched by phone number.
export const getEnquirySmsHistory = createServerFn()
	.middleware([authMiddleware])
	.validator((enquiryId: string) => enquiryId)
	.handler(async ({ data: enquiryId }) => {
		await requirePermission("enquiries:send-sms");

		const [enquiry] = await db
			.select({ phone: enquiries.phone })
			.from(enquiries)
			.where(eq(enquiries.id, enquiryId))
			.limit(1);
		if (!enquiry) return [];

		const rows = await db
			.select({
				id: smsBroadcasts.id,
				sentAt: smsBroadcasts.sentAt,
				content: smsBroadcasts.content,
				status: smsBroadcasts.smsBroadcastStatus,
				response: smsBroadcasts.response,
			})
			.from(smsBroadcasts)
			.where(
				and(
					eq(smsBroadcasts.recipientType, "enquiries"),
					arrayContains(smsBroadcasts.receipients, [enquiryId])
				)
			)
			.orderBy(desc(smsBroadcasts.sentAt))
			.limit(10);

		return rows.map(({ response, ...row }) => ({
			...row,
			deliveryStatus: response?.find((entry) => entry.number === enquiry.phone)?.status ?? null,
		}));
	});
