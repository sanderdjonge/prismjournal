import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { handlePnlCommand, PnlPeriod } from '@/lib/telegram-commands';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const VALID_PERIODS = new Set<PnlPeriod>(['today', 'week', 'month', 'all']);

const PNL_HELP =
    `📊 <b>PrismJournal PnL</b>\n\n` +
    `Usage:\n` +
    `  /pnl today\n` +
    `  /pnl week\n` +
    `  /pnl month\n` +
    `  /pnl all`;

export async function POST(request: NextRequest) {
    if (!process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ ok: false });

    // Fail-closed: require the webhook secret to be configured and to match.
    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    if (!WEBHOOK_SECRET || secretHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update = await request.json();
    const message = update?.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    // Telegram delivers chat.id as a JSON integer — coerce to string to match AlertConfig.telegramId
    const chatId = String(message.chat.id);
    const text = (message.text as string).trim();

    if (text === '/start') {
        const reply =
            `Welcome to <b>PrismJournal</b>!\n\n` +
            `Your Telegram Chat ID is:\n` +
            `<code>${chatId}</code>\n\n` +
            `Copy this ID and paste it in your PrismJournal settings:\n` +
            `Settings → Notifications → Telegram Chat ID\n\n` +
            `Once connected, you'll receive trade alerts here.`;
        await sendTelegramMessage(chatId, reply);
        return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/pnl')) {
        const parts = text.split(/\s+/);
        const periodArg = parts[1]?.toLowerCase();

        if (!periodArg || !VALID_PERIODS.has(periodArg as PnlPeriod)) {
            await sendTelegramMessage(chatId, PNL_HELP);
            return NextResponse.json({ ok: true });
        }

        const reply = await handlePnlCommand(chatId, periodArg as PnlPeriod);
        await sendTelegramMessage(chatId, reply);
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
