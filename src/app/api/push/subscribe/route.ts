import { withAuth } from '@/lib/api/withAuth'
import { ok, badRequest } from '@/lib/api/responses'
import { savePushSubscription } from '@/lib/push-notifications'
import { z } from 'zod'

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid request body')

  const validation = pushSubscribeSchema.safeParse(body)
  if (!validation.success) {
    return badRequest(validation.error.issues[0].message)
  }

  const subscription = await savePushSubscription(session.user.id, validation.data)
  return ok({ id: subscription.id, endpoint: subscription.endpoint })
})

export const runtime = 'nodejs'
