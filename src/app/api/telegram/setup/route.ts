import { ok, internalError } from '@/lib/api/responses';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function GET() {
    if (!BOT_TOKEN) {
        return internalError();
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
            return ok({ 
                success: true, 
                message: `Webhook registered: ${webhookUrl}`,
                result: data.result 
            });
        } else {
            return internalError();
        }
    } catch (error) {
        return internalError();
    }
}

export const runtime = 'nodejs';
