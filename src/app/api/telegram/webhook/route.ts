import { NextRequest, NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
    if (!BOT_TOKEN) return NextResponse.json({ ok: false });

    // Fail-closed: require the webhook secret to be configured and to match.
    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    if (!WEBHOOK_SECRET || secretHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update = await request.json();
    const message = update?.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text.trim();

    if (text === '/start') {
        const reply =
            `Welcome to <b>PrismJournal</b>!\n\n` +
            `Your Telegram Chat ID is:\n` +
            `<code>${chatId}</code>\n\n` +
            `Copy this ID and paste it in your PrismJournal settings:\n` +
            `Settings → Notifications → Telegram Chat ID\n\n` +
            `Once connected, you'll receive trade alerts here.`;

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'HTML' }),
        });
    }

    return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
