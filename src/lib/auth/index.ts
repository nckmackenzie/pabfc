import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { admin, twoFactor, username } from "better-auth/plugins";
import { reactStartCookies } from "better-auth/react-start";
import { UAParser } from "ua-parser-js";

import { db } from "@/drizzle/db";
import * as schema from "@/drizzle/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
		schema: {
			users: schema.users,
			accounts: schema.accounts,
			sessions: schema.sessions,
			verifications: schema.verifications,
		},
	}),
	account: {
		accountLinking: { enabled: true },
	},
	user: {
		additionalFields: {
			contact: {
				type: "string",
				required: true,
				input: true,
			},
			role: {
				type: "string",
				required: true,
				defaultValue: "user",
				input: true,
			},
			active: {
				type: "boolean",
				required: true,
				defaultValue: true,
				input: false,
			},
			deletedAt: {
				type: "date",
				required: false,
				fieldName: "deleted_at",
				returned: false,
				input: false,
			},
		},
	},
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		autoSignIn: true,
		password: {
			hash: async (password: string) => {
				return await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS));
			},
			verify: async ({
				hash,
				password,
			}: {
				password: string;
				hash: string;
			}) => {
				return await bcrypt.compare(password, hash);
			},
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24, // 1 day
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // Cache duration in seconds (5 minutes)
		},
	},
	plugins: [twoFactor(), admin(), username(), reactStartCookies()],
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			if (!ctx.path.startsWith("/sign-in")) return;
			const userAgent = ctx.request?.headers?.get("user-agent") ?? "unknown";
			const ipAddress =
				ctx.request?.headers?.get("x-forwarded-for") ||
				ctx.request?.headers?.get("x-real-ip") ||
				"127.0.0.1";
			const { browser } = UAParser(userAgent);
			const user = await db.query.users.findFirst({
				columns: { id: true, username: true },
				where: (users, { eq, or }) =>
					or(
						eq(users.contact, ctx.body.username),
						eq(users.email, ctx.body.username),
						eq(users.username, ctx.body.username),
					),
			});

			if (!user) {
				throw new Error("Invalid username or password");
			}

			const success = Boolean(ctx.context.newSession);

			await db.insert(schema.loginAttempts).values({
				userId: user.id,
				success,
				ipAddress,
				failureReason: success ? undefined : "Invalid username or password",
				userAgent: browser.name || "",
			});
		}),
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
