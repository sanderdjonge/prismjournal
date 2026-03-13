'use client';

import { useCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';

type Trade = {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    price: string;
    pnl: number;
    time: string;
    isActive?: boolean;
};

type RecentTradesProps = {
    trades: Trade[];
};

export default function RecentTrades({ trades }: RecentTradesProps) {
    const { formatPnl } = useCurrency();
    const activeTrades = trades.filter(t => t.isActive);
    const recentTrades = trades.filter(t => !t.isActive);

    const renderTradeItem = (trade: Trade) => (
        <div
            key={trade.id}
            className="flex justify-between items-center group cursor-pointer hover:bg-white/[0.03] p-3 rounded-2xl transition-all duration-300 border border-transparent hover:border-white/5"
        >
            <div className="flex items-center gap-4">
                {/* Symbol Icon Placeholder */}
                <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500",
                    trade.pnl >= 0 ? "bg-[#10b981]/10 text-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "bg-[#f43f5e]/10 text-[#f43f5e] shadow-[0_0_10px_rgba(244,63,94,0.1)]"
                )}>
                    <span className="text-xs font-black tracking-tighter uppercase">
                        {trade.symbol.substring(0, 3)}
                    </span>
                </div>

                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-black tracking-tight text-white">{trade.symbol}</p>
                        <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest",
                            trade.type === 'BUY' ? "text-[#10b981] border-[#10b981]/20 bg-[#10b981]/5" : "text-[#f43f5e] border-[#f43f5e]/20 bg-[#f43f5e]/5"
                        )}>
                            {trade.type === 'BUY' ? 'Long' : 'Short'}
                        </span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5 uppercase tracking-widest">
                        {trade.isActive ? 'Active TYDA' : `@ ${trade.price}`}
                    </p>
                </div>
            </div>

            <div className="text-right">
                <p className={cn(
                    "text-sm font-mono font-black tracking-tight",
                    trade.pnl >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"
                )}>
                    {formatPnl(trade.pnl)}
                </p>
                <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mt-0.5">
                    {trade.isActive ? 'Live Delta' : trade.time}
                </p>
            </div>
        </div>
    );

    return (
        <div className="p-6 flex flex-col h-full group/trades relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl -mr-16 -mt-16" />

            <div className="space-y-8 z-10">
                {/* Active Positions */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 group-hover/trades:text-gray-300 transition-colors">
                            Current Trades
                        </h3>
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            <span className="text-[8px] font-black text-accent uppercase tracking-widest">Live Flow</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        {activeTrades.length > 0 ? activeTrades.map(renderTradeItem) : (
                            <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest text-center py-4 italic">No active risk detected</p>
                        )}
                    </div>
                </section>

                {/* Historical Log */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 group-hover/trades:text-gray-300 transition-colors">
                            Recent History
                        </h3>
                    </div>
                    <div className="space-y-1">
                        {recentTrades.map(renderTradeItem)}
                    </div>
                </section>

                <button className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-300 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white border border-white/5 group/btn">
                    Open Full Audit Log
                </button>
            </div>
        </div>
    );
}
