import { NextRequest } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'
import {
  handlePnlCommand,
  handleScoreCommand,
  handleStatsCommand,
  handleRiskCommand,
  handleChallengeCommand,
  handleStreakCommand,
  handlePlanCommand,
  handleMistakesCommand,
  handleMoodCommand,
  handleNoteCommand,
  PnlPeriod,
  PNL_PERIODS,
  PNL_HELP,
  VALID_MOODS,
} from '@/lib/telegram-commands'
import { validateBody } from '@/lib/validations/common'
import { z } from 'zod'

const telegramUpdateSchema = z.object({
  message: z.object({
    chat: z.object({
      id: z.number(),
    }),
    text: z.string(),
  }).optional(),
}).passthrough()

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return Response.json({ ok: false })

  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
  if (!WEBHOOK_SECRET || secretHeader !== WEBHOOK_SECRET) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const validation = await validateBody(request, telegramUpdateSchema)
  if (!validation.success) return Response.json({ ok: true })
  const update = validation.data

  const message = update.message
  if (!message?.text) return Response.json({ ok: true })

  const chatId = String(message.chat.id)
  const text = String(message.text).trim()

  if (text === '/start') {
    const reply =
      `Welcome to <b>PrismJournal</b>!\n\n` +
      `Your Telegram Chat ID is:\n` +
      `<code>${chatId}</code>\n\n` +
      `Copy this ID and paste it in your PrismJournal settings:\n` +
      `Settings → Notifications → Telegram Chat ID\n\n` +
      `Once connected, you'll receive trade alerts here.\n\n` +
      `<b>Commands:</b>\n` +
      `/pnl &lt;today|week|month|all&gt;\n` +
      `/score — Prism Score\n` +
      `/stats &lt;symbol&gt; — Symbol stats\n` +
      `/risk — Account risk\n` +
      `/challenge — Challenge progress\n` +
      `/streak — Streaks\n` +
      `/plan — Strategy checklist\n` +
      `/mistakes — Recurring patterns\n` +
      `/mood &lt;${VALID_MOODS.join('|')}&gt; — Log mood\n` +
      `/note &lt;text&gt; — Add note`
    await sendTelegramMessage(chatId, reply)
    return Response.json({ ok: true })
  }

  const parts = text.split(/\s+/)
  const command = parts[0].toLowerCase()
  const commandArgs = parts.slice(1).join(' ')

  switch (command) {
    case '/pnl': {
      const periodArg = parts[1]?.toLowerCase()
      if (!periodArg || !(PNL_PERIODS as readonly string[]).includes(periodArg)) {
        await sendTelegramMessage(chatId, PNL_HELP)
        return Response.json({ ok: true })
      }
      const reply = await handlePnlCommand(chatId, periodArg as PnlPeriod)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/score': {
      const reply = await handleScoreCommand(chatId)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/stats': {
      if (!commandArgs) {
        await sendTelegramMessage(chatId, 'Usage: /stats &lt;symbol&gt;\nExample: /stats EURUSD')
        return Response.json({ ok: true })
      }
      const reply = await handleStatsCommand(chatId, commandArgs)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/risk': {
      const reply = await handleRiskCommand(chatId)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/challenge': {
      const reply = await handleChallengeCommand(chatId)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/streak': {
      const reply = await handleStreakCommand(chatId)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/plan': {
      const reply = await handlePlanCommand(chatId)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/mistakes': {
      const reply = await handleMistakesCommand(chatId)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/mood': {
      if (!commandArgs) {
        await sendTelegramMessage(chatId, `Usage: /mood &lt;${VALID_MOODS.join('|')}&gt;\nExample: /mood CALM`)
        return Response.json({ ok: true })
      }
      const reply = await handleMoodCommand(chatId, commandArgs)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    case '/note': {
      if (!commandArgs) {
        await sendTelegramMessage(chatId, 'Usage: /note &lt;text&gt;\nExample: /note Missed entry, market moved too fast')
        return Response.json({ ok: true })
      }
      const reply = await handleNoteCommand(chatId, commandArgs)
      await sendTelegramMessage(chatId, reply)
      return Response.json({ ok: true })
    }

    default:
      return Response.json({ ok: true })
  }
}

export const runtime = 'nodejs'
