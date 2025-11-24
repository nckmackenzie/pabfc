import { useSession } from '@tanstack/react-start/server'
import type { User } from '@/types/index.types'
import { env } from '@/env/server'

export function useAppSession() {
  return useSession<User>({
    name: 'app-session',
    password: env.SESSION_SECRET,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
    },
  })
}
