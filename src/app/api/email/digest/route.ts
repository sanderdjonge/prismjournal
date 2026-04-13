import { ok, notFound, badRequest, internalError } from '@/lib/api/responses'
import logger from '@/lib/logger'
import { getDefaultAccount } from '@/lib/getAccount'
import prisma from '@/lib/prisma'
import { sendWeeklyDigestEmail, sendTestEmail } from '@/lib/email'
import { computeWeeklyDigestData } from '@/lib/services/digest-computation'
import { validateBody } from '@/lib/validations/common'
import { z } from 'zod'

const digestPostSchema = z.object({
  test: z.string().optional(),
  email: z.string().email().optional(),
}).passthrough()

export async function GET() {
  try {
    const account = await getDefaultAccount()
    if (!account) {
      return notFound('Account')
    }

    const digestData = await computeWeeklyDigestData(account.id, account.userId)
    return ok(digestData)
  } catch (error) {
    logger.error({ err: error }, 'Failed to compute weekly digest')
    return internalError()
  }
}

export async function POST(request: Request) {
  try {
    const validation = await validateBody(request, digestPostSchema)
    if (!validation.success) return validation.response
    const { test, email: testEmail } = validation.data

    if (test && testEmail) {
      const result = await sendTestEmail(testEmail)
      return ok(result)
    }

    const account = await getDefaultAccount()
    if (!account) {
      return notFound('Account')
    }

    const alertConfig = await prisma.alertConfig.findUnique({
      where: { userId: account.userId },
    })

    if (!alertConfig?.email || !alertConfig.enableWeeklyDigest) {
      return badRequest('Weekly digest not enabled or email not configured')
    }

    const digestData = await computeWeeklyDigestData(account.id, account.userId)

    const result = await sendWeeklyDigestEmail({
      ...digestData,
      email: alertConfig.email,
      dashboardUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    })

    return ok(result)
  } catch (error) {
    logger.error({ err: error }, 'Failed to send weekly digest')
    return internalError()
  }
}

export const runtime = 'nodejs'
