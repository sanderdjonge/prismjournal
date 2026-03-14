import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { chatId } = await request.json().catch(() => ({ chatId: null }));
    if (!chatId) {
        return NextResponse.json({ error: 'No Chat ID provided' }, { status: 400 });
    }

    const ok = await sendTelegramMessage(
        chatId,
        '✅ <b>PrismJournal Connected!</b>\n\nYou will now receive trade alerts here.'
    );

    return NextResponse.json({ success: ok });
}

export const runtime = 'nodejs';
