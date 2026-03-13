import { NextResponse } from 'next/server';
import { getAIClient, NEBUL_MODEL } from '@/lib/ai';

export async function POST(request: Request) {
    let body: { prompt?: string; trade?: Record<string, unknown> };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { prompt, trade } = body;

    if (!prompt && !trade) {
        return NextResponse.json({ error: 'Provide a prompt or trade object' }, { status: 400 });
    }

    const userMessage = prompt ?? `Analyze this trade and provide actionable feedback:\n${JSON.stringify(trade, null, 2)}`;

    try {
        const response = await getAIClient().chat.completions.create({
            model: NEBUL_MODEL,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an expert trading coach analyzing trade data from a professional trading journal. Provide concise, data-driven feedback on execution quality, risk management, and psychological factors.',
                },
                { role: 'user', content: userMessage },
            ],
        });

        const content = response.choices[0]?.message?.content ?? '';
        return NextResponse.json({ result: content, model: response.model });
    } catch (error) {
        console.error('AI analysis error:', error);
        return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
    }
}

export const runtime = 'nodejs';
