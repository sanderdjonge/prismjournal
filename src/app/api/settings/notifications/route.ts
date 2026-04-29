import prisma from '@/lib/prisma'
import { sendTestEmail } from '@/lib/email'
import { validateBody, notificationSettingsSchema } from '@/lib/validations'
import { withAuth } from '@/lib/api/withAuth'
import { ok, badRequest, internalError } from '@/lib/api/responses'
import logger from '@/lib/logger'

const DEFAULTS = {
    enableSync: true,
    enableTrades: true,
    enableRisk: true,
    telegramId: null,
    mddThreshold: null,
    email: null,
    enableWeeklyDigest: false,
    enableMddAlerts: false,
    digestFrequency: 'WEEKLY',
    digestSendHour: 9,
    inAppToast: true,
    slackWebhookUrl: null,
    enableSlack: false,
}

export const GET = withAuth(async (_req, _ctx, session) => {
    const userId = session.user.id
    const config = await prisma.alertConfig.findUnique({ where: { userId } })
    return ok(config ?? DEFAULTS)
})

export const PATCH = withAuth(async (req, _ctx, session) => {
    const userId = session.user.id

    const validation = await validateBody(req, notificationSettingsSchema)
    if (!validation.success) {
        return validation.response
    }

    const body = validation.data

    const config = await prisma.alertConfig.upsert({
        where: { userId },
        update: { ...body },
        create: { userId, ...DEFAULTS, ...body },
    })

    return ok(config)
})

export const POST = withAuth(async (_req, _ctx, session) => {
    try {
        const email = session.user.email
        if (!email) {
            return badRequest('No email address on account')
        }

        const result = await sendTestEmail(email)
        return ok(result)
    } catch (error) {
        logger.error({ err: error }, 'Failed to send test email')
        return internalError()
    }
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
