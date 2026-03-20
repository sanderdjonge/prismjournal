import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function GET() {
    if (!BOT_TOKEN) {
        return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
    }

    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/telegram/webhook`;
    
    try {
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const response = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: webhookUrl,
                    ...(webhookSecret ? { secret_token: webhookSecret } : {}),
                }),
            }
        );
        
        const data = await response.json();
        
        if (data.ok) {
            return NextResponse.json({ 
                success: true, 
                message: `Webhook registered: ${webhookUrl}`,
                result: data.result 
            });
        } else {
            return NextResponse.json({ 
                success: false, 
                error: data.description 
            }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: 'Failed to register webhook' 
        }, { status: 500 });
    }
}

export const runtime = 'nodejs';
