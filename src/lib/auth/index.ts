import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { reactStartCookies } from 'better-auth/react-start'
import { username,admin,twoFactor } from 'better-auth/plugins';

import { db } from '@/drizzle/db';
import * as schema from '@/drizzle/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
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
        type: 'string',
        required: true,
        input: true,
      },
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: true,
      },
      active: {
        type: 'boolean',
        required: true,
        defaultValue: true,
        input: false,
      },
      deletedAt: {
        type: 'date',
        required: false,
        fieldName: 'deleted_at',
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
  plugins: [twoFactor(), admin(), username(), reactStartCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;