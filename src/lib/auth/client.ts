import {
  inferAdditionalFields,
  usernameClient,
  adminClient,
  twoFactorClient
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import type { auth } from '@/lib/auth';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL || 'http://localhost:3000',
  plugins: [adminClient(),twoFactorClient(), usernameClient(), inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, useSession } = authClient;