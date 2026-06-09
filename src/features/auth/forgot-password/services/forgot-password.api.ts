import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, desc, eq, gt, gte, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	accounts,
	passwordResetAttempts,
	passwordResetChallenges,
	sessions,
	users,
} from "@/drizzle/schema";
import {
	completeTemporaryPasswordResetSchema,
	requestTemporaryPasswordResetSchema,
} from "@/features/auth/forgot-password/services/schemas";
import {
	generateTemporaryPassword,
	hashPassword,
	verifyPassword,
} from "@/lib/auth/password";
import { ValidationError } from "@/lib/error-handling/app-error";
import { internationalizePhoneNumber } from "@/lib/helpers";
import { inngest } from "@/lib/inngest/client";

const RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const RESET_EXPIRY_MS = 15 * 60 * 1000;
const MAX_RESET_REQUESTS = 5;
const MAX_RESET_ATTEMPTS = 5;
const GENERIC_RESET_RESPONSE = {
	message:
		"If an active account matches, we will send a temporary password to the phone number on file.",
};

function getAuthSecret() {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error("BETTER_AUTH_SECRET is required for password reset");
	}
	return secret;
}

function getEncryptionKey() {
	return crypto.createHash("sha256").update(getAuthSecret()).digest();
}

export function encryptTemporaryPassword(temporaryPassword: string) {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
	const encrypted = Buffer.concat([
		cipher.update(temporaryPassword, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();

	return `${iv.toString("base64url")}.${tag.toString(
		"base64url",
	)}.${encrypted.toString("base64url")}`;
}

export function decryptTemporaryPassword(encryptedTemporaryPassword: string) {
	const [iv, tag, encrypted] = encryptedTemporaryPassword.split(".");
	if (!iv || !tag || !encrypted) {
		throw new Error("Invalid encrypted temporary password");
	}

	const decipher = crypto.createDecipheriv(
		"aes-256-gcm",
		getEncryptionKey(),
		Buffer.from(iv, "base64url"),
	);
	decipher.setAuthTag(Buffer.from(tag, "base64url"));

	return Buffer.concat([
		decipher.update(Buffer.from(encrypted, "base64url")),
		decipher.final(),
	]).toString("utf8");
}

function normalizeIdentifier(identifier: string) {
	return identifier.trim().toLowerCase();
}

function hashIdentifier(identifier: string) {
	return crypto
		.createHmac("sha256", getAuthSecret())
		.update(normalizeIdentifier(identifier))
		.digest("hex");
}

function getContactCandidates(identifier: string) {
	const normalized = normalizeIdentifier(identifier);
	const candidates = new Set([normalized]);

	if (normalized.startsWith("+254")) {
		candidates.add(`0${normalized.slice(4)}`);
		candidates.add(normalized.slice(1));
	} else if (normalized.startsWith("254")) {
		candidates.add(`0${normalized.slice(3)}`);
		candidates.add(`+${normalized}`);
	} else if (normalized.startsWith("0")) {
		candidates.add(`254${normalized.slice(1)}`);
		candidates.add(`+254${normalized.slice(1)}`);
	}

	return [...candidates];
}

function getRequestMetadata() {
	const request = getRequest();
	const forwardedFor = request.headers.get("x-forwarded-for");
	const ipAddress =
		forwardedFor?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		"127.0.0.1";
	const userAgent = request.headers.get("user-agent") ?? "unknown";

	return { ipAddress, userAgent };
}

async function getMatchingCredentialUser(identifier: string) {
	const normalized = normalizeIdentifier(identifier);
	const contactCandidates = getContactCandidates(identifier);

	const [user] = await db
		.select({
			id: users.id,
			name: users.name,
			contact: users.contact,
		})
		.from(users)
		.innerJoin(
			accounts,
			and(eq(accounts.userId, users.id), eq(accounts.providerId, "credential")),
		)
		.where(
			and(
				eq(users.active, true),
				eq(users.banned, false),
				isNull(users.deleted_at),
				ne(users.role, "member"),
				or(
					...contactCandidates.map((candidate) => eq(users.contact, candidate)),
					sql`lower(${users.username}) = ${normalized}`,
					sql`lower(${users.email}) = ${normalized}`,
				),
			),
		)
		.limit(1);

	return user;
}

async function isRateLimited(identifierHash: string, ipAddress: string) {
	const windowStart = new Date(Date.now() - RESET_REQUEST_WINDOW_MS);
	const [identifierRequests] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(passwordResetAttempts)
		.where(
			and(
				eq(passwordResetAttempts.identifierHash, identifierHash),
				gte(passwordResetAttempts.createdAt, windowStart),
			),
		);
	const [ipRequests] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(passwordResetAttempts)
		.where(
			and(
				eq(passwordResetAttempts.ipAddress, ipAddress),
				gte(passwordResetAttempts.createdAt, windowStart),
			),
		);

	return (
		Number(identifierRequests?.count ?? 0) >= MAX_RESET_REQUESTS ||
		Number(ipRequests?.count ?? 0) >= MAX_RESET_REQUESTS
	);
}

export const requestTemporaryPasswordReset = createServerFn({ method: "POST" })
	.validator(requestTemporaryPasswordResetSchema)
	.handler(async ({ data }) => {
		const identifierHash = hashIdentifier(data.identifier);
		const { ipAddress, userAgent } = getRequestMetadata();

		if (await isRateLimited(identifierHash, ipAddress)) {
			return GENERIC_RESET_RESPONSE;
		}

		const user = await getMatchingCredentialUser(data.identifier);
		await db.insert(passwordResetAttempts).values({
			userId: user?.id ?? null,
			identifierHash,
			ipAddress,
			userAgent,
			matched: Boolean(user),
		});

		if (!user) {
			return GENERIC_RESET_RESPONSE;
		}

		const temporaryPassword = generateTemporaryPassword(12);
		const challenge = await db.transaction(async (tx) => {
			await tx
				.update(passwordResetChallenges)
				.set({
					encryptedTemporaryPassword: null,
					usedAt: new Date(),
				})
				.where(
					and(
						eq(passwordResetChallenges.userId, user.id),
						isNull(passwordResetChallenges.usedAt),
					),
				);

			const [insertedChallenge] = await tx
				.insert(passwordResetChallenges)
				.values({
					userId: user.id,
					identifierHash,
					temporaryPasswordHash: await hashPassword(temporaryPassword),
					encryptedTemporaryPassword:
						encryptTemporaryPassword(temporaryPassword),
					ipAddress,
					userAgent,
					expiresAt: new Date(Date.now() + RESET_EXPIRY_MS),
				})
				.returning({ id: passwordResetChallenges.id });

			return insertedChallenge;
		});

		try {
			await inngest.send({
				name: "app/auth.send-password-reset-temporary-password",
				data: { challengeId: challenge.id },
			});
		} catch (error) {
			await db
				.update(passwordResetChallenges)
				.set({ encryptedTemporaryPassword: null })
				.where(eq(passwordResetChallenges.id, challenge.id));
			console.warn("Failed to queue password reset SMS", {
				error: error instanceof Error ? error.message : error,
			});
		}

		return GENERIC_RESET_RESPONSE;
	});

export const completeTemporaryPasswordReset = createServerFn({ method: "POST" })
	.validator(completeTemporaryPasswordResetSchema)
	.handler(async ({ data }) => {
		const identifierHash = hashIdentifier(data.identifier);
		const now = new Date();

		const challenges = await db
			.select({
				id: passwordResetChallenges.id,
				userId: passwordResetChallenges.userId,
				temporaryPasswordHash: passwordResetChallenges.temporaryPasswordHash,
			})
			.from(passwordResetChallenges)
			.innerJoin(users, eq(users.id, passwordResetChallenges.userId))
			.innerJoin(
				accounts,
				and(
					eq(accounts.userId, passwordResetChallenges.userId),
					eq(accounts.providerId, "credential"),
				),
			)
			.where(
				and(
					eq(passwordResetChallenges.identifierHash, identifierHash),
					isNull(passwordResetChallenges.usedAt),
					gt(passwordResetChallenges.expiresAt, now),
					sql`${passwordResetChallenges.attemptCount} < ${MAX_RESET_ATTEMPTS}`,
					eq(users.active, true),
					eq(users.banned, false),
					isNull(users.deleted_at),
				),
			)
			.orderBy(desc(passwordResetChallenges.createdAt))
			.limit(5);

		const matchingChallenge = await challenges.reduce<
			Promise<(typeof challenges)[number] | null>
		>(async (matchPromise, challenge) => {
			const match = await matchPromise;
			if (match) return match;

			return (await verifyPassword(
				data.temporaryPassword,
				challenge.temporaryPasswordHash,
			))
				? challenge
				: null;
		}, Promise.resolve(null));

		if (!matchingChallenge) {
			if (challenges[0]) {
				await db
					.update(passwordResetChallenges)
					.set({
						attemptCount: sql`${passwordResetChallenges.attemptCount} + 1`,
						encryptedTemporaryPassword: null,
					})
					.where(eq(passwordResetChallenges.id, challenges[0].id));
			}

			throw new ValidationError("Invalid or expired temporary password");
		}

		await db.transaction(async (tx) => {
			await tx
				.update(accounts)
				.set({ password: await hashPassword(data.newPassword) })
				.where(
					and(
						eq(accounts.userId, matchingChallenge.userId),
						eq(accounts.providerId, "credential"),
					),
				);

			await tx
				.delete(sessions)
				.where(eq(sessions.userId, matchingChallenge.userId));

			await tx
				.update(passwordResetChallenges)
				.set({
					encryptedTemporaryPassword: null,
					usedAt: now,
				})
				.where(eq(passwordResetChallenges.userId, matchingChallenge.userId));
		});

		return { message: "Password reset successfully" };
	});

export function maskResetDestination(contact: string) {
	const phoneNumber = internationalizePhoneNumber(contact, true);
	return phoneNumber.replace(/^(\+\d{3})\d+(\d{3})$/, "$1******$2");
}
