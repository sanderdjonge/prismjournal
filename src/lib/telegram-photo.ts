import { readFileSync } from 'fs'
import { basename } from 'path'
import logger from './logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function sendTelegramPhoto(chatId: string, filePath: string, caption?: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN not configured, cannot send photo')
    return false
  }

  try {
    const fileBuffer = readFileSync(filePath)
    const fileName = basename(filePath)
    const formData = new FormData()
    formData.append('chat_id', chatId)
    formData.append('photo', new Blob([fileBuffer], { type: 'image/png' }), fileName)
    if (caption) {
      formData.append('caption', caption)
      formData.append('parse_mode', 'HTML')
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const body = await res.text()
      logger.warn({ status: res.status, body }, 'Telegram sendPhoto failed')
      return false
    }

    return true
  } catch (error) {
    logger.error({ err: error, chatId }, 'Telegram sendPhoto error')
    return false
  }
}
