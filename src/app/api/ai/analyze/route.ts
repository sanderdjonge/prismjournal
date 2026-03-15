import { NextRequest } from 'next/server';
import { getAIClient, NEBUL_MODEL } from '@/lib/ai';
import { withAuth } from '@/lib/api/withAuth';
import { badRequest, internalError, ok } from '@/lib/api/responses';

export const POST = withAuth(async (request: NextRequest) => {
    let body: { prompt?: string; trade?: Record<string, unknown> };
    try {
        body = await request.json();
    } catch {
        return badRequest('Invalid JSON');
    }

    const { prompt, trade } = body;

    if (!prompt && !trade) {
        return badRequest('Provide a prompt or trade object');
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
        return ok({ result: content, model: response.model });
    } catch {
        return internalError();
    }
});

export const runtime = 'nodejs';
