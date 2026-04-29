'use client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export interface PushSubscriptionJSON {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Browser does not support notifications')
  }
  return Notification.requestPermission()
}

export async function subscribeToPush(): Promise<PushSubscriptionJSON | null> {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key not configured')
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true

  const result = await subscription.unsubscribe()
  return result
}

export function getPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  return navigator.serviceWorker.ready
    .then((reg) => reg.pushManager.getSubscription())
    .catch(() => null)
}
