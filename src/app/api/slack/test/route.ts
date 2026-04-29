import { withAuth } from '@/lib/api/withAuth'
import { ok, badRequest, internalError } from '@/lib/api/responses'
import { sendSlackMessage } from '@/lib/slack'
import prisma from '@/lib/prisma'
import logger from '@/lib/logger'
import { z } from 'zod'

const slackTestSchema = z.object({
  webhookUrl: z.string().url().optional(),
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}))
  const validation = slackTestSchema.safeParse(body)
  if (!validation.success) {
    return badRequest(validation.error.issues[0].message)
  }

  const alertConfig = await prisma.alertConfig.findUnique({
    where: { userId: session.user.id },
  })

  const webhookUrl = validation.data.webhookUrl ?? alertConfig?.slackWebhookUrl
  if (!webhookUrl) {
    return badRequest('No Slack webhook URL configured')
  }

  try {
    const success = await sendSlackMessage(webhookUrl, {
      text: '✅ PrismJournal Slack Integration Connected!',
      attachments: [
        {
          color: '#36a64f',
          title: 'Test Notification',
          text: 'You will now receive trade alerts and risk notifications here.',
          footer: 'PrismJournal',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    })

    if (!success) {
      return internalError()
    }

    return ok({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Slack test failed')
    return internalError()
  }
})

export const runtime = 'nodejs'
