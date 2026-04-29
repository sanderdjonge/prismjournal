import { withAuth } from '@/lib/api/withAuth'
import { ok, badRequest } from '@/lib/api/responses'
import { deletePushSubscription } from '@/lib/push-notifications'
import { z } from 'zod'

const pushUnsubscribeSchema = z.object({
  endpoint: z.string().min(1),
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid request body')

  const validation = pushUnsubscribeSchema.safeParse(body)
  if (!validation.success) {
    return badRequest(validation.error.issues[0].message)
  }

  await deletePushSubscription(session.user.id, validation.data.endpoint)
  return ok({ success: true })
})

export const runtime = 'nodejs'
