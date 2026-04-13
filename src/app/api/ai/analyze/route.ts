import { NextRequest } from 'next/server';
import { getAIClient, NEBUL_MODEL } from '@/lib/ai';
import { withAuth } from '@/lib/api/withAuth';
import { internalError, ok } from '@/lib/api/responses';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';

const analyzeSchema = z.object({
    prompt: z.string().optional(),
    trade: z.record(z.unknown()).optional(),
}).refine(data => data.prompt || data.trade, {
    message: 'Provide a prompt or trade object',
});

export const POST = withAuth(async (request: NextRequest) => {
    const validation = await validateBody(request, analyzeSchema);
    if (!validation.success) return validation.response;
    const { prompt, trade } = validation.data;

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
