// src/hooks/useExcursionTrades.ts
import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/constants/queryConfig';
import type { JournalTrade } from '@/app/journal/page';

export interface QuadrantTrade extends JournalTrade {
    exitDistFromEntry: number | null;
}

// Raw shape expected by mapToQuadrantTrade (Prisma field names)
// Note: fetchExcursionTrades maps the API response into this shape before calling mapToQuadrantTrade
interface RawTrade {
    id: string;
    ticket: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    commission: number | null;
    swap: number | null;
    pnl: number;
    time: string;
    entryTime: string;
    exitTime: string | null;
    mood: string | null;
    planCompliance: string | null;
    closeReason: string | null;
    notes: string | null;
    strategy: { name: string } | null;
    account: { name: string } | null;
    accountId: string | null;
    mae: number | null;
    mfe: number | null;
    tags: { id: string; name: string; color?: string | null }[];
    entryRating: number | null;
    exitRating: number | null;
    managementRating: number | null;
    rMultiple: number | null;
    initialStopLoss: number | null;
    beTriggered: boolean;
    volume: number;
}

// Shape returned by GET /api/trades (already formatted by the API route)
interface ApiTrade {
    id: string;
    ticket: string;
    symbol: string;
    type: 'LONG' | 'SHORT';
    volume: number;
    entry: number;
    exit: number;
    stopLoss: number | null;
    initialStopLoss: number | null;
    takeProfit: number | null;
    commission: number;
    swap: number;
    pnl: number;
    time: string;
    mood: string | null;
    planCompliance: string | null;
    closeReason: string | null;
    notes: string | null;
    strategy: string | null;
    entryTime: string;
    exitTime: string | null;
    tags: { id: string; name: string; color?: string | null }[];
    accountId: string | null;
    accountName: string | null;
    mae: number | null;
    mfe: number | null;
    screenshotCount?: number;
}

export function computeExitDist(
    entry: number,
    exit: number | null,
    direction: 'LONG' | 'SHORT',
): number | null {
    if (exit == null) return null;
    return direction === 'LONG' ? exit - entry : entry - exit;
}

export function mapToQuadrantTrade(t: RawTrade): QuadrantTrade {
    return {
        id: t.id,
        ticket: t.ticket,
        symbol: t.symbol,
        type: t.direction,
        volume: t.volume,
        entry: t.entryPrice,
        exit: t.exitPrice ?? 0,
        stopLoss: t.stopLoss,
        initialStopLoss: t.initialStopLoss,
        takeProfit: t.takeProfit,
        commission: t.commission ?? 0,
        swap: t.swap ?? 0,
        pnl: t.pnl,
        time: t.time,
        mood: t.mood,
        planCompliance: t.planCompliance,
        closeReason: t.closeReason,
        notes: t.notes,
        strategy: t.strategy?.name ?? null,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        tags: t.tags,
        accountName: t.account?.name ?? null,
        accountId: t.accountId,
        mae: t.mae,
        mfe: t.mfe,
        exitDistFromEntry: computeExitDist(t.entryPrice, t.exitPrice, t.direction),
    };
}

// Adapt the API-formatted response into the RawTrade shape for mapToQuadrantTrade
function apiTradeToRaw(t: ApiTrade): RawTrade {
    return {
        id: t.id,
        ticket: t.ticket,
        symbol: t.symbol,
        direction: t.type,
        entryPrice: t.entry,
        exitPrice: t.exit === 0 ? null : t.exit,
        stopLoss: t.stopLoss,
        initialStopLoss: t.initialStopLoss,
        takeProfit: t.takeProfit,
        commission: t.commission,
        swap: t.swap,
        pnl: t.pnl,
        time: t.time,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        mood: t.mood,
        planCompliance: t.planCompliance,
        closeReason: t.closeReason,
        notes: t.notes,
        strategy: t.strategy ? { name: t.strategy } : null,
        account: t.accountName ? { name: t.accountName } : null,
        accountId: t.accountId,
        mae: t.mae,
        mfe: t.mfe,
        tags: t.tags,
        entryRating: null,
        exitRating: null,
        managementRating: null,
        rMultiple: null,
        beTriggered: false,
        volume: t.volume,
    };
}

interface UseExcursionTradesParams {
    from?: string;
    to?: string;
    account?: string | null;
    limit?: number;
}

async function fetchExcursionTrades(params: UseExcursionTradesParams): Promise<QuadrantTrade[]> {
    const base = new URLSearchParams();
    base.set('limit', String(params.limit ?? 500));
    if (params.from) base.set('from', params.from);
    if (params.to) base.set('to', params.to);
    if (params.account) base.set('account', params.account);

    const [winsRes, lossesRes] = await Promise.all([
        fetch(`/api/trades?${new URLSearchParams({ ...Object.fromEntries(base), result: 'WIN' })}`),
        fetch(`/api/trades?${new URLSearchParams({ ...Object.fromEntries(base), result: 'LOSS' })}`),
    ]);

    if (!winsRes.ok || !lossesRes.ok) throw new Error('Failed to fetch excursion trades');

    const [wins, losses] = await Promise.all([winsRes.json(), lossesRes.json()]) as [
        { trades: ApiTrade[] }, { trades: ApiTrade[] }
    ];

    return [...(wins.trades ?? []), ...(losses.trades ?? [])]
        .filter(t => t.mae != null && t.mae > 0 && t.mfe != null && t.mfe > 0)
        .map(t => mapToQuadrantTrade(apiTradeToRaw(t)));
}

export function useExcursionTrades(params: UseExcursionTradesParams = {}) {
    return useQuery<QuadrantTrade[]>({
        queryKey: ['excursion-trades', params.from ?? '', params.to ?? '', params.account ?? '', params.limit ?? 500],
        queryFn: () => fetchExcursionTrades(params),
        staleTime: STALE_TIME.DEFAULT,
    });
}
