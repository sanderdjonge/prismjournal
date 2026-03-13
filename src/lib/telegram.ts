const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
    if (!BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN not configured');
        return false;
    }
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });
        return res.ok;
    } catch (e) {
        console.error('Telegram send failed:', e);
        return false;
    }
}
