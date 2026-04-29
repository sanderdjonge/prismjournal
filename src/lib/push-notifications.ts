import webpush from 'web-push'
import prisma from './prisma'
import logger from './logger'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? 'noreply@prismjournal.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export interface PushSubscriptionKeys {
  p256dh: string
  auth: string
}

export interface PushSubscriptionData {
  endpoint: string
  keys: PushSubscriptionKeys
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
}

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionData,
) {
  return prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId,
        endpoint: subscription.endpoint,
      },
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  })
}

export async function deletePushSubscription(
  userId: string,
  endpoint: string,
) {
  return prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  })
}

export async function sendPushNotification(
  userId: string,
  payload: PushPayload,
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    logger.warn('VAPID keys not configured — skipping push notification')
    return []
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  if (subscriptions.length === 0) return []

  return sendPushToAll(subscriptions, payload)
}

export async function sendPushToAll(
  subscriptions: SubscriptionsForUser,
  payload: PushPayload,
) {
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        )
        return { success: true, endpoint: sub.endpoint }
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          logger.info({ endpoint: sub.endpoint }, 'Push subscription expired — removing')
          await prisma.pushSubscription.deleteMany({
            where: { endpoint: sub.endpoint },
          }).catch(() => {})
        } else {
          logger.warn({ endpoint: sub.endpoint, err: error }, 'Push send failed')
        }
        return { success: false, endpoint: sub.endpoint }
      }
    }),
  )

  return results.map((r) => r.status === 'fulfilled' ? r.value : { success: false, endpoint: 'unknown' })
}
type SubscriptionsForUser = Awaited<ReturnType<typeof prisma.pushSubscription.findMany>>
