import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { withAuth } from '@/lib/api/withAuth';

export const POST = withAuth(async (req, _ctx, _session) => {
    const { chatId } = await req.json().catch(() => ({ chatId: null }));
    if (!chatId) {
        return NextResponse.json({ error: 'No Chat ID provided' }, { status: 400 });
    }

    const ok = await sendTelegramMessage(
        chatId,
        '✅ <b>PrismJournal Connected!</b>\n\nYou will now receive trade alerts here.'
    );

    return NextResponse.json({ success: ok });
});

export const runtime = 'nodejs';
