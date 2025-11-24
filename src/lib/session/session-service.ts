import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth'

export const getUserSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()

    if (!request?.headers) {
      return null
    }

    const userSession = await auth.api.getSession({ headers: request.headers })

    if (!userSession) return null

    return { user: userSession.user, session: userSession.session }
  },
)
