import { NextRequest } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { handlePnlCommand, PnlPeriod, PNL_PERIODS, PNL_HELP } from '@/lib/telegram-commands';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';

const telegramUpdateSchema = z.object({
    message: z.object({
        chat: z.object({
            id: z.number(),
        }),
        text: z.string(),
    }).optional(),
}).passthrough();

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
    if (!process.env.TELEGRAM_BOT_TOKEN) return Response.json({ ok: false });

    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    if (!WEBHOOK_SECRET || secretHeader !== WEBHOOK_SECRET) {
        return Response.json({ ok: false }, { status: 401 });
    }

    const validation = await validateBody(request, telegramUpdateSchema);
    if (!validation.success) return Response.json({ ok: true });
    const update = validation.data;

    const message = update.message;
    if (!message?.text) return Response.json({ ok: true });

    const chatId = String(message.chat.id);
    const text = String(message.text).trim();

    if (text === '/start') {
        const reply =
            `Welcome to <b>PrismJournal</b>!\n\n` +
            `Your Telegram Chat ID is:\n` +
            `<code>${chatId}</code>\n\n` +
            `Copy this ID and paste it in your PrismJournal settings:\n` +
            `Settings → Notifications → Telegram Chat ID\n\n` +
            `Once connected, you'll receive trade alerts here.`;
        await sendTelegramMessage(chatId, reply);
        return Response.json({ ok: true });
    }

    if (text.startsWith('/pnl')) {
        const parts = text.split(/\s+/);
        const periodArg = parts[1]?.toLowerCase();

        if (!periodArg || !(PNL_PERIODS as readonly string[]).includes(periodArg)) {
            await sendTelegramMessage(chatId, PNL_HELP);
            return Response.json({ ok: true });
        }

        const reply = await handlePnlCommand(chatId, periodArg as PnlPeriod);
        await sendTelegramMessage(chatId, reply);
        return Response.json({ ok: true });
    }

    return Response.json({ ok: true });
}

export const runtime = 'nodejs';
