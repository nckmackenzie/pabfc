import crypto from "node:crypto";
import { format, startOfDay } from "date-fns";
import { and, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	memberMemberships,
	memberRegistrationLinks,
	membershipPlans,
	members,
	passwordResetChallenges,
	type SMSBroadcastResponse,
	smsBroadcasts,
	users,
} from "@/drizzle/schema";
import { decryptTemporaryPassword } from "@/features/auth/forgot-password/services/forgot-password.api";
import { replaceVariables } from "@/features/communication/lib/utils";
import { internationalizePhoneNumber } from "@/lib/helpers";
import { inngest } from "@/lib/inngest/client";
import { sendSms } from "@/lib/sms";
import { toTitleCase } from "@/lib/utils";

export const sendSmsBroadcast = inngest.createFunction(
	{
		id: "send-sms-broadcast",
	},
	{ event: "app/communications.send-sms-broadcast" },
	async ({ event, step }) => {
		const { broadcastId } = event.data;

		const broadcastDetails = await step.run("get-receipients", async () => {
			const broadcast = await db.query.smsBroadcasts.findFirst({
				columns: { receipients: true, content: true },
				where: eq(smsBroadcasts.id, broadcastId),
			});
			if (!broadcast) {
				throw new Error("Broadcast not found");
			}
			return broadcast;
		});

		const sendSmsStep = await step.run("send-sms", async () => {
			const broadcastResponse: Array<SMSBroadcastResponse["SMSMessageData"]["Recipients"][number]> =
				[];
			const { receipients, content } = broadcastDetails;
			for (const receipient of receipients) {
				const [{ firstName, lastName, contact }] = await db
					.select({
						firstName: members.firstName,
						lastName: members.lastName,
						contact: members.contact,
					})
					.from(members)
					.where(eq(members.id, receipient));
				if (!contact) {
					continue;
				}

				const memberDataRecord: Record<string, string | number> = {
					firstName: toTitleCase(firstName.toLowerCase()),
					lastName: toTitleCase(lastName.toLowerCase()),
				};

				const message = replaceVariables(content, memberDataRecord);

				const res = await sendSms({
					message,
					to: [internationalizePhoneNumber(contact, true)],
				});
				if (res) {
					broadcastResponse.push(res.SMSMessageData.Recipients[0]);
				}
			}
			return broadcastResponse;
		});

		await step.run("update-broadcast", async () => {
			await db
				.update(smsBroadcasts)
				.set({
					smsBroadcastStatus: "sent",
					response: sendSmsStep,
				})
				.where(eq(smsBroadcasts.id, broadcastId));
		});
	}
);

export const sendTestSmsToUser = inngest.createFunction(
	{ id: "send-sms-test-to-user" },
	{ event: "app/communications.send-test-to-user" },
	async ({ event }) => {
		const { content, contact } = event.data;
		const res = await sendSms({ message: content, to: contact });
		return res;
	}
);

export const sendUserPassword = inngest.createFunction(
	{ id: "send-user-password" },
	{ event: "app/users.send.temporary.password" },
	async ({ event }) => {
		const { userId, password } = event.data;
		const user = await db.query.users.findFirst({
			columns: { contact: true, name: true },
			where: and(eq(users.id, userId), eq(users.banned, false)),
		});
		if (!user) {
			throw new Error("User not found");
		}

		const getFirstName = user?.name?.split(" ")[0];
		const response = await sendSms({
			message: `Dear ${toTitleCase(getFirstName)}, your temporary password is ${password}. Please change it as soon as you log in!`,
			to: [internationalizePhoneNumber(user.contact as string, true)],
		});
		if (!response) {
			throw new Error("Failed to send temporary password SMS");
		}
		return response;
	}
);

export const sendPasswordResetTemporaryPassword = inngest.createFunction(
	{ id: "send-password-reset-temporary-password" },
	{ event: "app/auth.send-password-reset-temporary-password" },
	async ({ event, step }) => {
		const { challengeId } = event.data;

		const challenge = await step.run("get-reset-challenge", async () => {
			const [record] = await db
				.select({
					id: passwordResetChallenges.id,
					encryptedTemporaryPassword: passwordResetChallenges.encryptedTemporaryPassword,
					contact: users.contact,
					name: users.name,
				})
				.from(passwordResetChallenges)
				.innerJoin(users, eq(users.id, passwordResetChallenges.userId))
				.where(
					and(
						eq(passwordResetChallenges.id, challengeId),
						isNull(passwordResetChallenges.sentAt),
						isNull(passwordResetChallenges.usedAt),
						isNotNull(passwordResetChallenges.encryptedTemporaryPassword),
						gt(passwordResetChallenges.expiresAt, new Date()),
						eq(users.active, true),
						eq(users.banned, false),
						isNull(users.deleted_at),
						ne(users.role, "member")
					)
				)
				.limit(1);

			if (!record?.encryptedTemporaryPassword || !record.contact) {
				throw new Error("Password reset challenge not found");
			}

			return {
				...record,
				contact: record.contact,
				encryptedTemporaryPassword: record.encryptedTemporaryPassword,
			};
		});

		const temporaryPassword = decryptTemporaryPassword(challenge.encryptedTemporaryPassword);

		const response = await step.run("send-reset-sms", async () => {
			const firstName = challenge.name.split(" ")[0];
			return await sendSms({
				message: `Dear ${toTitleCase(firstName)}, use this temporary password to reset your PABFC account password: ${temporaryPassword}. It expires in 15 minutes and can only be used once.`,
				to: [internationalizePhoneNumber(challenge.contact, true)],
			});
		});

		if (!response) {
			throw new Error("Failed to send password reset SMS");
		}

		await step.run("mark-reset-sms-sent", async () => {
			await db
				.update(passwordResetChallenges)
				.set({
					encryptedTemporaryPassword: null,
					sentAt: new Date(),
				})
				.where(eq(passwordResetChallenges.id, challenge.id));
		});

		return response;
	}
);

export const sendRegistrationLink = inngest.createFunction(
	{ id: "send-member-registration-link" },
	{ event: "app/members.send.registration.link" },
	async ({ event, step }) => {
		const { memberId } = event.data;
		const member = await db.query.members.findFirst({
			columns: { contact: true, firstName: true },
			where: and(eq(members.id, memberId), isNull(members.deletedAt)),
		});

		if (!member) {
			throw new Error("Member not found");
		}

		const registrationLink = await step.run("generate-registration-link", async () => {
			const existingLink = await db.query.memberRegistrationLinks.findFirst({
				columns: { shortCode: true },
				where: and(
					eq(memberRegistrationLinks.memberId, memberId),
					isNull(memberRegistrationLinks.usedAt)
				),
			});

			if (existingLink) {
				return `${process.env.MEMBER_PORTAL_URL as string}/register/${existingLink.shortCode}`;
			}

			const shortCode = crypto.randomBytes(4).toString("hex").substring(0, 6);

			await db.insert(memberRegistrationLinks).values({
				memberId,
				shortCode,
			});

			return `${process.env.MEMBER_PORTAL_URL as string}/register/${shortCode}`;
		});

		await step.run("send-registration-link", async () => {
			const res = await sendSms({
				message: `Dear ${toTitleCase(member.firstName)}, welcome to PABFC💪🏿! Click the link provided to complete your registration and create your account: ${registrationLink}`,
				to: [internationalizePhoneNumber(member.contact as string, true)],
			});
			return res;
		});
	}
);

export const sendMembershipReminder = inngest.createFunction(
	{ id: "send-membership-reminder" },
	{ event: "app/members.send.membership.reminder" },
	async ({ event, step }) => {
		const { membershipId } = event.data;

		const membership = await step.run("get-membership-details", async () => {
			const [record] = await db
				.select({
					firstName: members.firstName,
					contact: members.contact,
					planName: membershipPlans.name,
					endDate: memberMemberships.endDate,
				})
				.from(memberMemberships)
				.innerJoin(members, eq(memberMemberships.memberId, members.id))
				.leftJoin(membershipPlans, eq(memberMemberships.membershipPlanId, membershipPlans.id))
				.where(eq(memberMemberships.id, membershipId))
				.limit(1);

			if (!record?.contact) {
				throw new Error("Membership not found");
			}
			return record;
		});

		await step.run("send-reminder-sms", async () => {
			const firstName = toTitleCase(membership.firstName);
			const planName = membership.planName ?? "membership";
			const endDateObj = membership.endDate ? new Date(`${membership.endDate}T00:00:00`) : null;
			const isExpired = endDateObj ? endDateObj < startOfDay(new Date()) : false;
			const formattedDate = endDateObj ? format(endDateObj, "dd MMM yyyy") : "";

			const message = isExpired
				? `Dear ${firstName}, your ${planName} membership expired on ${formattedDate}. Please renew to continue enjoying your benefits at Prime Age Fitness.`
				: `Dear ${firstName}, your ${planName} membership expires on ${formattedDate}. Please renew soon to continue enjoying your benefits at Prime Age Fitness.`;

			return await sendSms({
				message,
				to: [internationalizePhoneNumber(membership.contact, true)],
			});
		});
	}
);
