// src/lib/validations/tradeForm.ts
import { z } from 'zod';

export const tradeFormSchema = z.object({
    symbol: z.string().min(1, 'Symbol is required').max(20),
    type: z.enum(['LONG', 'SHORT'], { required_error: 'Direction is required' }),
    volume: z.coerce.number().positive('Volume must be positive'),
    entryPrice: z.coerce.number().positive('Entry price must be positive'),
    exitPrice: z.string().optional(),
    takeProfit: z.string().optional(),
    stopLoss: z.string().optional(),
    isClosed: z.boolean(),
    strategy: z.string().max(100).optional(),
    mood: z.enum(['CALM', 'CONFIDENT', 'NEUTRAL', 'ANXIOUS', 'FOMO', 'REVENGE']).optional(),
    planCompliance: z.enum(['FOLLOWED', 'DEVIATED', 'PARTIAL']).optional(),
    notes: z.string().max(5000).optional(),
}).refine(
    (data) => !data.isClosed || (data.exitPrice !== undefined && data.exitPrice !== '' && !isNaN(Number(data.exitPrice))),
    { message: 'Exit price is required when closing a trade', path: ['exitPrice'] }
);

export type TradeFormValues = z.infer<typeof tradeFormSchema>;
