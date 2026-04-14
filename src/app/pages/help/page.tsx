'use client';

import { useState, useEffect, Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import PropFirmReferenceTable, { type PropFirmRow } from '@/components/prop-firm/PropFirmReferenceTable';
import {
    HelpCircle, BookOpen, Building2, Loader2, LayoutDashboard,
    BarChart2, BookMarked, Shield, TrendingUp, ChevronDown, ChevronRight,
    Info, AlertTriangle, Lightbulb, Target,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

type Section = {
    id: string;
    label: string;
    icon: React.ReactNode;
};

// ─── Primitive layout helpers ─────────────────────────────────────────────────

function SectionCard({ title, icon, children, id }: { title: string; icon: React.ReactNode; children: React.ReactNode; id: string }) {
    return (
        <section id={id} className="glass-card p-6 border-white/5 space-y-5 scroll-mt-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <span className="text-primary">{icon}</span>
                {title}
            </h2>
            {children}
        </section>
    );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="border-t border-white/5 pt-4">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 w-full text-left mb-3 group"
            >
                <span className="text-white font-black text-xs uppercase tracking-wider group-hover:text-primary transition-colors">{title}</span>
                {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
            </button>
            {open && <div className="space-y-3">{children}</div>}
        </div>
    );
}

function P({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-gray-400 leading-relaxed">{children}</p>;
}

function Note({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-2 bg-primary/5 border border-primary/15 rounded-lg px-4 py-3">
            <Info size={14} className="text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-gray-300 leading-relaxed">{children}</p>
        </div>
    );
}

function Tip({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-2 bg-accent/5 border border-accent/15 rounded-lg px-4 py-3">
            <Lightbulb size={14} className="text-accent mt-0.5 shrink-0" />
            <p className="text-xs text-gray-300 leading-relaxed">{children}</p>
        </div>
    );
}

function Warning({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-2 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-4 py-3">
            <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-300 leading-relaxed">{children}</p>
        </div>
    );
}

function Code({ children }: { children: React.ReactNode }) {
    return <code className="bg-white/5 text-primary text-xs font-mono px-1.5 py-0.5 rounded">{children}</code>;
}

function StatTable({ rows }: { rows: [string, string, string?][] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
                <tbody>
                    {rows.map(([label, value, sub], i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                            <td className="py-2 pr-4 text-gray-500 font-bold uppercase tracking-wider w-1/3">{label}</td>
                            <td className="py-2 text-gray-200">{value}{sub && <span className="text-gray-500 ml-2">{sub}</span>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function BenchmarkTable({ rows, headers }: { rows: string[][]; headers: string[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="border-b border-white/10">
                        {headers.map((h, i) => (
                            <th key={i} className="py-2 pr-4 text-left text-gray-500 font-black uppercase tracking-wider">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                            {row.map((cell, j) => (
                                <td key={j} className="py-2 pr-4 text-gray-300">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Section: Getting Started ─────────────────────────────────────────────────

function GettingStartedSection() {
    return (
        <SectionCard id="getting-started" title="Getting Started" icon={<BookOpen size={16} />}>
            <P>
                PrismJournal is a trading journal for retail and prop firm traders. Log every trade, track your
                performance over time, and understand the psychological patterns behind your results — all in one place.
            </P>

            <SubSection title="Setting up your first account">
                <P>Go to <strong className="text-white">Trading Accounts</strong> via the user dropdown (top-right). Click <strong className="text-white">Add Account</strong> and fill in:</P>
                <StatTable rows={[
                    ['Account name', 'A label you recognise — e.g. "FTMO Phase 1" or "Personal Futures"'],
                    ['Broker', 'Your broker\'s name (optional)'],
                    ['Currency', 'The account\'s base currency'],
                    ['Starting balance', 'Your initial deposit or challenge account size'],
                ]} />
                <P>Enable <strong className="text-white">Prop Firm Mode</strong> if this is a funded challenge account. You can create as many accounts as you need — each is tracked independently.</P>
            </SubSection>

            <SubSection title="Syncing trades from MetaTrader 5">
                <P>PrismJournal syncs automatically from MT5 via a <strong className="text-white">Bridge Key</strong> — a secure token that identifies your account.</P>
                <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside leading-relaxed">
                    <li>Open your account settings and copy the <strong className="text-white">Bridge Key</strong>.</li>
                    <li>Attach the <strong className="text-white">PrismSync</strong> Expert Advisor (<Code>PrismSync.mq5</Code>) to any chart in MT5.</li>
                    <li>Paste your Bridge Key and your PrismJournal server URL into the EA settings.</li>
                    <li>The EA pushes new trades as they open and close — no manual action needed.</li>
                </ol>
                <Note>If you run multiple MT5 accounts, each MT5 login number automatically routes trades to the correct PrismJournal account. One Bridge Key covers all your accounts.</Note>
            </SubSection>

            <SubSection title="Adding trades manually">
                <P>Click <strong className="text-white">+ New Trade</strong> from the Dashboard or Journal. Required fields: instrument, direction (Long/Short), volume, entry price, and entry time. Add a stop loss to enable R-multiple calculation. Toggle <strong className="text-white">Trade Closed</strong> to record the exit — or leave it off to track an open position and close it later.</P>
            </SubSection>
        </SectionCard>
    );
}

// ─── Section: Dashboard ───────────────────────────────────────────────────────

function DashboardSection() {
    return (
        <SectionCard id="dashboard" title="Dashboard" icon={<LayoutDashboard size={16} />}>
            <P>Your trading command centre. All metrics reflect the selected period — <strong className="text-white">7D / 30D / 90D / 1Y</strong> — and update instantly when you switch accounts.</P>

            <SubSection title="Key Metrics">
                <StatTable rows={[
                    ['Total P&L', 'Net realised profit/loss across all closed trades in the period. Open positions are excluded.'],
                    ['Win Rate', 'Percentage of closed trades that ended in profit. Sub-label shows the raw W/L count.'],
                    ['Profit Factor', 'Gross profit ÷ gross loss. Above 1.5 is solid; above 2.0 is strong.'],
                    ['Avg R-Multiple', 'Average trade result in units of your risk (requires stop loss on each trade).'],
                    ['Expectancy', 'Average P&L per trade. Multiply by monthly trade count to project income.'],
                    ['Max Drawdown', 'Largest peak-to-trough drop in cumulative P&L during the period.'],
                ]} />
                <Warning>A high win rate does not mean you are profitable. A 70% win rate with 0.5R winners and 2R losers loses money. Always read Win Rate alongside Profit Factor.</Warning>
            </SubSection>

            <SubSection title="Equity Curve">
                <P>Area chart of your <strong className="text-white">cumulative P&L</strong> over time — one point per trading day. The curve shows your <em>entire trade history</em>, not just the selected period, so you always see the full journey. Hover any point for the exact date and P&L value.</P>
                <Tip>A rising curve that occasionally dips and recovers shows a healthy system with manageable drawdowns. A curve that falls for months and never recovers is a signal to review your strategy.</Tip>
            </SubSection>

            <SubSection title="Performance Gauges">
                <P>Two arc-style dials for an instant visual read:</P>
                <StatTable rows={[
                    ['Win Rate gauge', 'Fills toward 100%. Shown in green.'],
                    ['Profit Factor gauge', 'Fills toward a max of 5.0. Shown in cyan. Past the halfway mark (2.5) indicates a strong edge.'],
                ]} />
            </SubSection>

            <SubSection title="Performance Breakdown">
                <StatTable rows={[
                    ['Total Trades', 'Count of closed trades in the selected period'],
                    ['Best Trade', 'Single largest winning trade by P&L'],
                    ['Worst Trade', 'Single largest losing trade (absolute value)'],
                    ['Win Streak', 'Longest consecutive winning run across all time'],
                    ['Loss Streak', 'Longest consecutive losing run across all time'],
                    ['Avg Duration', 'Mean time between entry and exit. Shown in minutes or hours/minutes.'],
                ]} />
                <Tip>Compare Avg Duration on winning trades vs. losing trades. If losers are held much longer, you are likely cutting winners short and letting losers run — a classic behavioural trap.</Tip>
            </SubSection>

            <SubSection title="Trade Calendar">
                <P>Current-month grid, one cell per day. <span className="text-accent font-semibold">Green</span> = net profit that day, <span className="text-danger font-semibold">red</span> = net loss. Each cell shows the day's P&L plus win/loss trade count.</P>
                <P>The right-side column shows weekly summaries (total P&L, trade count, win rate). The bottom-right corner shows month-to-date totals.</P>
                <Tip>Look for day-of-week patterns — are Mondays consistently red? Does Friday afternoon wreck your week? Patterns in the calendar often reveal timing and behavioural issues.</Tip>
            </SubSection>

            <SubSection title="Recent Trades">
                <P>Two panels on the right side of the calendar:</P>
                <StatTable rows={[
                    ['Current Trades', 'Open positions synced live from MT5. A pulsing dot confirms the live connection.'],
                    ['Recent History', 'The last few closed trades with symbol, direction, entry price, and realised P&L.'],
                ]} />
            </SubSection>
        </SectionCard>
    );
}

// ─── Section: Analytics ───────────────────────────────────────────────────────

function AnalyticsSection() {
    return (
        <SectionCard id="analytics" title="Analytics Page" icon={<BarChart2 size={16} />}>
            <P>Deeper statistical view accessible from the sidebar. Use the date-range and account filters at the top to isolate any period — a single month, a strategy test window, or a specific market regime.</P>

            <SubSection title="Gauges row">
                <StatTable rows={[
                    ['Profit Factor', 'Same as Dashboard — gross profit ÷ gross loss, scaled to max 5.'],
                    ['Expectancy', 'Average P&L per trade in currency, scaled to max $3,000.'],
                    ['Risk / Reward', 'Mean realised reward-to-risk ratio. How many dollars earned per dollar risked.'],
                ]} />
            </SubSection>

            <SubSection title="Breakeven Metrics Widget">
                <P>Tracks how often your trades hit breakeven (BE) and what happens afterward. Key metrics:</P>
                <StatTable rows={[
                    ['BE Trigger Rate', 'Percentage of trades where price hit your initial stop loss distance before any other action.'],
                    ['BE Survival Rate', 'Of trades that hit BE, what percentage still closed in profit.'],
                    ['BE Avg Outcome', 'Average P&L for trades that triggered breakeven vs. those that did not.'],
                ]} />
                <Tip>If your BE Survival Rate is low, moving to breakeven may be hurting more than helping — you are getting stopped out on noise that would have been a winner.</Tip>
            </SubSection>

            <SubSection title="Edge Profile by Symbol">
                <P>Bar chart of total P&L per instrument. Green bars are profitable symbols; red bars are unprofitable. Hover any bar for P&L and win rate on that symbol.</P>
                <Tip>If GOLD is consistently red and NAS100 is consistently green, seriously consider whether trading GOLD is hurting your overall performance.</Tip>
            </SubSection>

            <SubSection title="Edge Evolution">
                <P>Line chart of your <em>running average P&L per trade</em> as trade count increases. A line that stabilises flat after an early settling period confirms a real, consistent edge. A line that peaks early then falls suggests your edge may be smaller than initial results implied.</P>
            </SubSection>

            <SubSection title="Trading Hours Widget">
                <P>24-hour histogram showing when you trade and how you perform. Use the dropdown at top-right to switch views:</P>
                <BenchmarkTable
                    headers={['View', 'What it shows']}
                    rows={[
                        ['Trades', 'Stacked green/red bars showing wins and losses per hour'],
                        ['Win Rate', 'Win rate percentage per hour (green ≥60%, yellow 40-60%, red <40%)'],
                        ['Profit', 'Total P&L per hour — green for profit, red for loss'],
                        ['R:R', 'Average risk/reward ratio per hour'],
                    ]}
                />
                <Tip>Hover any bar to see detailed stats. Cross-reference with your P&L by time to find your best and worst trading hours.</Tip>
            </SubSection>

            <SubSection title="Exit Quality Quadrant">
                <P>Visual scatter plot mapping every closed trade by its Maximum Favorable Excursion (MFE) and Maximum Adverse Excursion (MAE). Each dot is a trade:</P>
                <StatTable rows={[
                    ['X-axis (MAE)', 'How far price moved against you — the worst it got before exit'],
                    ['Y-axis (MFE)', 'How far price moved in your favour — the best it got before exit'],
                    ['Colour', 'Green = winner, Red = loser'],
                    ['Quadrant zones', 'Clean (top-right), Early Out (top-left), Survived (bottom-right), Painful (bottom-left)'],
                ]} />
                <Note>Clean exits are near the top-right — you captured most of the move. Painful exits are bottom-left — price went against you and never recovered. Reviewing your Painful trades reveals where your entries or timing need work.</Note>
            </SubSection>

            <SubSection title="Mean Loss / Trade">
                <P>Your average losing trade size in currency. The accompanying progress bar is the inverse of your Profit Factor — shorter is better. A contextual assessment label updates as your Profit Factor improves.</P>
            </SubSection>
        </SectionCard>
    );
}

// ─── Section: Trade Journal ───────────────────────────────────────────────────

function JournalSection() {
    return (
        <SectionCard id="journal" title="Trade Journal" icon={<BookMarked size={16} />}>
            <SubSection title="Psychology fields">
                <P>Every trade has an optional psychology section. Tracking this consistently is what separates a trading journal from a trade log.</P>

                <div className="space-y-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider text-gray-300 mb-2">Mood</p>
                        <BenchmarkTable
                            headers={['Mood', 'What it means']}
                            rows={[
                                ['Calm', 'Relaxed, focused, fully in control'],
                                ['Confident', 'High conviction, well-prepared setup'],
                                ['Neutral', 'Neither positive nor negative emotional state'],
                                ['Anxious', 'Worried, second-guessing, elevated stress'],
                                ['FOMO', 'Fear of missing out — entering late or without a proper setup'],
                                ['Revenge', 'Trading to recover a loss, bypassing your rules'],
                            ]}
                        />
                        <Tip>Trades tagged FOMO or Revenge are almost universally underperforming. After 50+ trades, filter your journal to these moods and compare the P&L — the pattern is usually sobering and immediately actionable.</Tip>
                    </div>

                    <div>
                        <p className="text-xs font-black uppercase tracking-wider text-gray-300 mb-2">Plan Compliance</p>
                        <StatTable rows={[
                            ['Followed', 'Trade taken exactly as your rules dictate'],
                            ['Partial', 'Deviated from part of the plan (moved stop, exited early, etc.)'],
                            ['Deviated', 'Ignored the plan entirely'],
                        ]} />
                        <Note>Compliance tracking separates strategy performance (how your plan performs when followed) from execution performance. If your plan wins 60% when followed but your journal shows 45% overall, execution is the problem — not the strategy.</Note>
                    </div>

                    <div>
                        <p className="text-xs font-black uppercase tracking-wider text-gray-300 mb-2">Quality Ratings (1–5)</p>
                        <StatTable rows={[
                            ['Entry Rating', 'How well-timed and well-placed was your entry?'],
                            ['Exit Rating', 'Did you exit at target, or cut early / hold too long?'],
                            ['Management Rating', 'How well did you manage the trade once open?'],
                        ]} />
                    </div>
                </div>
            </SubSection>

            <SubSection title="R-Multiple explained">
                <P><strong className="text-white">R</strong> stands for Risk. An R-multiple expresses your trade result in units of the risk you took:</P>
                <div className="bg-white/[0.03] rounded-lg p-4 text-xs font-mono text-gray-300 space-y-1">
                    <p>Risk in price = |Entry Price − Stop Loss|</p>
                    <p>R-Multiple = Trade P&L ÷ Dollar value of 1R</p>
                </div>
                <BenchmarkTable
                    headers={['Trade', 'Risk ($)', 'P&L ($)', 'R-Multiple']}
                    rows={[
                        ['Long NAS100 @ 19,000, SL 18,950, TP 19,150', '$100', '+$300', '+3.0R'],
                        ['Long EURUSD @ 1.0800, SL 1.0770, exit 1.0775', '$100', '−$83', '−0.83R'],
                        ['Short GOLD @ 2,350, SL 2,360, exit 2,340', '$100', '+$100', '+1.0R'],
                    ]}
                />
                <Note>R-multiples require a Stop Loss to be recorded on the trade. Without it, PrismJournal cannot determine your intended risk.</Note>
            </SubSection>

            <SubSection title="Screenshots">
                <P>Attach chart screenshots to any trade — multiple images per trade, tagged with timeframe (M15, H1, etc.) and capture point (Entry or Close). Screenshots are stored securely and linked to the trade record.</P>
                <Tip>Attach one screenshot at entry and one at exit for every trade. Reviewing them six months later alongside your notes is more valuable than memory alone.</Tip>
            </SubSection>

            <SubSection title="Bulk Operations">
                <P>Select multiple trades at once using the checkboxes on the left. Bulk actions include:</P>
                <StatTable rows={[
                    ['Bulk Delete', 'Remove multiple trades at once'],
                    ['Bulk Tag', 'Apply a tag to all selected trades'],
                    ['Bulk Strategy', 'Assign or unassign a strategy to multiple trades'],
                    ['Bulk Account', 'Move trades between accounts'],
                ]} />
                <Note>Strategy assignment triggers automatic compliance re-evaluation for all closed trades in the selection.</Note>
            </SubSection>

            <SubSection title="Filters">
                <P>Narrow down your journal view with filter chips at the top:</P>
                <StatTable rows={[
                    ['Date Range', 'Filter by entry date — preset ranges or custom'],
                    ['Side', 'Long or Short trades only'],
                    ['Result', 'Winners, losers, or breakeven trades'],
                    ['Symbol', 'Filter by instrument'],
                    ['Tag', 'Show only trades with a specific tag'],
                    ['Account', 'View trades from a specific account'],
                    ['Strategy', 'Filter by assigned strategy'],
                ]} />
            </SubSection>
        </SectionCard>
    );
}

// ─── Section: Strategies ─────────────────────────────────────────────────────

function StrategiesSection() {
    return (
        <SectionCard id="strategies" title="Strategies" icon={<Target size={16} />}>
            <P>Strategies let you define rules for your trading and track adherence. Each strategy has configurable rules, and PrismJournal automatically evaluates closed trades against those rules.</P>

            <SubSection title="Creating a Strategy">
                <P>Go to <strong className="text-white">Strategies</strong> in the sidebar. Click <strong className="text-white">+ New Strategy</strong> and give it a name and optional description. Then add rules from the available types:</P>
                <BenchmarkTable
                    headers={['Rule Type', 'What it checks']}
                    rows={[
                        ['Max Daily Loss', 'Limit loss per calendar day'],
                        ['Max Daily Trades', 'Limit number of trades per day'],
                        ['Min R:R Ratio', 'Require minimum risk/reward ratio'],
                        ['Mandatory Stop Loss', 'Require stop loss on every trade'],
                        ['Max Position Size', 'Limit lot/contract size'],
                        ['No Overtrading', 'Limit trades per hour'],
                        ['Allowed Hours', 'Only trade during specific hours'],
                        ['Allowed Symbols', 'Restrict trading to specific instruments'],
                        ['Max Holding Time', 'Maximum time to hold a position'],
                        ['Min Holding Time', 'Minimum time before closing'],
                    ]}
                />
            </SubSection>

            <SubSection title="Adherence Score">
                <P>Every strategy shows an <strong className="text-white">Adherence %</strong> — the percentage of trades that followed all enabled rules. 100% means perfect compliance.</P>
                <BenchmarkTable
                    headers={['Score', 'Interpretation']}
                    rows={[
                        ['80-100%', 'Excellent discipline — following your plan'],
                        ['60-80%', 'Good but room for improvement'],
                        ['40-60%', 'Inconsistent — review which rules you break most'],
                        ['0-40%', 'Poor — strategy may not match your actual trading'],
                    ]}
                />
            </SubSection>

            <SubSection title="Tiltmeter">
                <P>The <strong className="text-white">Tiltmeter</strong> shows your current risk of tilt based on recent rule violations. It aggregates violations by severity:</P>
                <StatTable rows={[
                    ['Low (🧘)', 'Few recent violations — you are trading clean'],
                    ['Medium (😐)', 'Some violations — stay disciplined'],
                    ['High (😤)', 'Multiple violations — consider pausing'],
                    ['Critical (🤯)', 'Many violations — take a break and review'],
                ]} />
                <Warning>Violations are weighted by severity. Max Daily Loss and Mandatory Stop Loss are serious; Allowed Hours is minor. The tiltmeter helps you recognise when emotional trading is creeping in.</Warning>
            </SubSection>

            <SubSection title="Assigning Strategies to Trades">
                <P>In the Journal, use the <strong className="text-white">Strategy</strong> column to assign a strategy to each trade. You can also bulk-assign via the selection dropdown. Once assigned, closed trades are automatically evaluated against all enabled rules.</P>
                <Note>Re-assigning a strategy re-evaluates compliance from scratch. Previous violations are cleared and new ones are calculated.</Note>
            </SubSection>
        </SectionCard>
    );
}

// ─── Section: Performance Page ───────────────────────────────────────────────

function PerformanceSection() {
    return (
        <SectionCard id="performance" title="Performance Ledger" icon={<TrendingUp size={16} />}>
            <P>A focused view on equity evolution and edge stability. Filter by period (7D/30D/90D/1Y) and account at the top.</P>

            <SubSection title="Key Metrics">
                <StatTable rows={[
                    ['Net P&L', 'Total profit/loss for the selected period'],
                    ['Max Drawdown', 'Largest peak-to-trough decline'],
                    ['Sharpe Ratio', 'Risk-adjusted return — higher is better'],
                    ['Profit Factor', 'Gross profit ÷ gross loss'],
                ]} />
            </SubSection>

            <SubSection title="Master Equity Curve">
                <P>Your cumulative P&L over time. Shows the full equity journey for the selected period, not just the summary. Hover any point for exact date and balance.</P>
            </SubSection>

            <SubSection title="Trade Expectancy Gauge">
                <P>Average P&L per trade. Multiply by your typical monthly trade count to project income. Also shows average win and average loss for context.</P>
            </SubSection>

            <SubSection title="Monthly Returns">
                <P>Bar chart showing P&L by calendar month. Green bars are profitable months; red bars are losing months. Useful for identifying seasonal patterns or regime changes in your performance.</P>
            </SubSection>
        </SectionCard>
    );
}

// ─── Section: Accounts & Prop Firms ───────────────────────────────────────────

function AccountsSection() {
    return (
        <SectionCard id="accounts" title="Accounts & Prop Firms" icon={<Shield size={16} />}>
            <SubSection title="Multiple accounts">
                <P>PrismJournal supports unlimited trading accounts under one login. Each account has its own trade history, dashboard, equity curve, and prop firm rules. Switch accounts using the selector at the top of any page.</P>
                <P>To retire a completed or failed challenge, use the <strong className="text-white">Archive</strong> button on the Trading Accounts page. Archived accounts retain all data but disappear from the main navigation.</P>
            </SubSection>

            <SubSection title="Prop Firm Mode">
                <P>Enable when creating or editing an account. Select a predefined firm (rules are pre-filled) or enter custom rules manually.</P>
                <StatTable rows={[
                    ['Daily Loss Limit', 'Maximum loss allowed on any single calendar day (% of account size). Resets at midnight.'],
                    ['Max Drawdown', 'Maximum total loss from starting balance (static) or from your equity high-water mark (trailing). Does not reset.'],
                    ['Drawdown Type', 'Static: floor is fixed from day one. Trailing: floor rises with your equity — a profitable run gives you less room to lose.'],
                    ['Profit Target', '% gain required to pass the current phase.'],
                    ['Min Trading Days', 'Minimum number of days you must have at least one open trade.'],
                    ['Time Limit', 'Calendar days to complete the phase before the account expires.'],
                ]} />
                <Warning>Daily Loss Limit and Max Drawdown apply simultaneously. You must respect both on every single day — hitting either one alone fails the account.</Warning>
            </SubSection>

            <SubSection title="Violation alerts">
                <P>PrismJournal monitors your account against all rules via the daily snapshot and live sync. Violations appear in-app and optionally via email or Telegram:</P>
                <BenchmarkTable
                    headers={['Severity', 'Meaning']}
                    rows={[
                        ['Warning', 'Approaching a limit — take care'],
                        ['Critical', 'At the limit — one bad trade ends the account'],
                        ['Breach', 'Limit exceeded — account has failed'],
                    ]}
                />
            </SubSection>

            <SubSection title="Static vs. Trailing drawdown">
                <P><strong className="text-white">Static:</strong> Your floor is set from your starting balance and never moves. Start with $100,000, 10% max drawdown → floor is always $90,000.</P>
                <P><strong className="text-white">Trailing:</strong> The floor follows your equity high-water mark upward. Reach $110,000 → floor moves to $99,000. Reach $115,000 → floor moves to $103,500. The floor never moves down, only up. Trailing drawdown is stricter because a good run permanently shrinks your loss budget.</P>
            </SubSection>
        </SectionCard>
    );
}

// ─── Section: Statistics Deep Dive ────────────────────────────────────────────

function StatisticsSection() {
    return (
        <SectionCard id="statistics" title="Understanding Your Statistics" icon={<TrendingUp size={16} />}>
            <SubSection title="Win Rate">
                <div className="bg-white/[0.03] rounded-lg p-3 text-xs font-mono text-gray-300">
                    Win Rate (%) = (Winning Trades / Total Closed Trades) × 100
                </div>
                <P>What win rate is "good" depends entirely on your average winner vs. average loser:</P>
                <BenchmarkTable
                    headers={['Win Rate', 'To be profitable, your average winner must be…']}
                    rows={[
                        ['30%', 'At least 2.3× your average loser'],
                        ['40%', 'At least 1.5× your average loser'],
                        ['50%', 'Greater than your average loser'],
                        ['60%', 'Can be slightly below your average loser'],
                    ]}
                />
            </SubSection>

            <SubSection title="Profit Factor">
                <div className="bg-white/[0.03] rounded-lg p-3 text-xs font-mono text-gray-300">
                    Profit Factor = Sum of all winning P&Ls / |Sum of all losing P&Ls|
                </div>
                <BenchmarkTable
                    headers={['Profit Factor', 'Interpretation']}
                    rows={[
                        ['Below 1.0', 'Losing money overall'],
                        ['1.0', 'Breakeven'],
                        ['1.0 – 1.3', 'Marginal edge; may be fragile'],
                        ['1.3 – 1.5', 'Developing edge'],
                        ['1.5 – 2.0', 'Solid, consistent edge — target range'],
                        ['2.0 – 3.0', 'Strong edge'],
                        ['Above 3.0', 'Exceptional — verify with 100+ trades'],
                    ]}
                />
                <Warning>A Profit Factor above 5.0 on fewer than 30 trades is statistically unreliable. As sample size grows it typically reverts toward its "true" value. Trust the number more with 100+ trades.</Warning>
            </SubSection>

            <SubSection title="Expectancy">
                <div className="bg-white/[0.03] rounded-lg p-3 text-xs font-mono text-gray-300 space-y-1">
                    <p>Expectancy = Total P&L / Number of Closed Trades</p>
                    <p>— or —</p>
                    <p>Expectancy = (Win Rate × Avg Winner) − (Loss Rate × Avg Loser)</p>
                </div>
                <P>Example: 55% win rate, $150 average winner, $100 average loser:</P>
                <div className="bg-white/[0.03] rounded-lg p-3 text-xs font-mono text-gray-300">
                    (0.55 × $150) − (0.45 × $100) = $82.50 − $45 = <span className="text-accent">$37.50 per trade</span>
                </div>
                <P>At 80 trades per month: projected monthly profit = $37.50 × 80 = $3,000.</P>
                <Note>Expectancy describes the long-run average. Any single month will vary. The formula becomes reliable after 50–100+ trades.</Note>
            </SubSection>

            <SubSection title="Max Drawdown">
                <div className="bg-white/[0.03] rounded-lg p-3 text-xs font-mono text-gray-300 space-y-1">
                    <p>At each trade: Drawdown = Peak P&L so far − Current P&L</p>
                    <p>Max Drawdown = largest Drawdown value across all trades</p>
                </div>
                <BenchmarkTable
                    headers={['Max Drawdown (% of account)', 'Assessment']}
                    rows={[
                        ['Below 5%', 'Excellent risk control'],
                        ['5 – 10%', 'Good — within typical prop firm limits'],
                        ['10 – 20%', 'Elevated — review position sizing'],
                        ['Above 20%', 'Significant risk — reduce leverage or review strategy'],
                    ]}
                />
                <Warning>A 50% drawdown requires a 100% return just to break even. Keeping drawdown small is the most important form of capital preservation.</Warning>
            </SubSection>

            <SubSection title="Average Duration">
                <P>Mean time between entry and exit across all closed trades. Compare winning vs. losing trades — if losers are held significantly longer, you are likely cutting winners short and letting losers run.</P>
                <BenchmarkTable
                    headers={['Duration', 'Typical style']}
                    rows={[
                        ['Seconds to minutes', 'Scalping — watch commission drag'],
                        ['Minutes to 2 hours', 'Intraday — most prop firm rules compliant'],
                        ['2+ hours to overnight', 'Intraday swing'],
                        ['Days to weeks', 'Position/swing — check weekend holding restrictions'],
                    ]}
                />
            </SubSection>
        </SectionCard>
    );
}

// ─── Section: Prop Firm Reference Table ───────────────────────────────────────

function PropFirmSection({ firms, loading }: { firms: PropFirmRow[]; loading: boolean }) {
    return (
        <SectionCard id="prop-firms" title="Prop Firm Reference" icon={<Building2 size={16} />}>
            <P>Rules and limits for all supported prop firms. Used when creating or editing a prop firm account.</P>
            {loading ? (
                <div className="flex items-center gap-2 py-4 text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs">Loading…</span>
                </div>
            ) : (
                <PropFirmReferenceTable firms={firms} />
            )}
        </SectionCard>
    );
}

// ─── Section: FAQ ─────────────────────────────────────────────────────────────

type FAQItem = { q: string; a: React.ReactNode };

const FAQ_ITEMS: FAQItem[] = [
    {
        q: 'My trades are not appearing after syncing from MT5. What should I check?',
        a: <>Confirm the PrismSync EA is active (smiley face in the MT5 terminal). Verify the Bridge Key in the EA settings exactly matches the one shown in your PrismJournal account — it is case-sensitive. Check that the server URL ends with <Code>/api/sync</Code>. If trades still do not appear, check the MT5 Journal tab for error messages from the EA.</>,
    },
    {
        q: 'Why does my R-multiple show as 0 or not appear?',
        a: 'R-multiple requires a Stop Loss price on the trade. If no stop was placed in MT5, or if you entered the trade manually without a stop, PrismJournal cannot calculate risk. Edit the trade and add a stop loss price to enable the calculation.',
    },
    {
        q: 'The equity curve looks different from my account balance. Is something wrong?',
        a: 'The equity curve plots cumulative P&L starting from zero, not your absolute account balance. A $10,000 account with $1,500 total profit shows +$1,500, not $11,500. This isolates your trading performance from how much capital you started with.',
    },
    {
        q: 'Why does Profit Factor show "—"?',
        a: 'Profit Factor is undefined when there are zero losing trades in the period (you cannot divide by zero). If you only have winning trades in the selected window, try a longer period.',
    },
    {
        q: 'Can I view trades across multiple accounts at the same time?',
        a: 'Each account is tracked independently. The account selector at the top of each page determines which account\'s data is shown. Cross-account combined views are not currently available.',
    },
    {
        q: 'I recorded the wrong exit price. How do I fix it?',
        a: 'Open the Trade Journal, find the trade, click to open its details, then click Edit. You can update any field including exit price, exit time, and P&L. Save and all metrics recalculate automatically.',
    },
    {
        q: 'What is the difference between Daily Loss Limit and Max Drawdown?',
        a: 'Daily Loss Limit resets every day — it is the maximum you may lose on a single trading day. Max Drawdown is a lifetime limit that does not reset. Both rules apply simultaneously. Breaching either one alone fails the account.',
    },
    {
        q: 'How do I set up two-factor authentication (2FA)?',
        a: 'Go to account settings via the user dropdown (top-right) and find the Security section. Enable Authenticator App (TOTP), scan the QR code with an app like Google Authenticator or Authy, enter the six-digit code to confirm, and save. All subsequent logins will prompt for a code after your password.',
    },
    {
        q: 'Can I track paper / demo accounts?',
        a: 'Yes. Set the source type to Paper when adding an account. All statistics, analytics, and prop firm tracking work identically for paper accounts. Keeping paper and live accounts separate lets you compare strategy performance between simulation and live conditions.',
    },
    {
        q: 'What happens to my data if I archive an account?',
        a: 'Archiving hides the account from the main navigation and account selector. All trade history, analytics, and prop firm records are fully preserved. You can always visit Trading Accounts to view archived accounts or restore them.',
    },
];

function FAQSection() {
    const [open, setOpen] = useState<number | null>(null);
    return (
        <SectionCard id="faq" title="Frequently Asked Questions" icon={<HelpCircle size={16} />}>
            <div className="divide-y divide-white/5">
                {FAQ_ITEMS.map((item, i) => (
                    <div key={i} className="py-3">
                        <button
                            onClick={() => setOpen(open === i ? null : i)}
                            className="flex items-start justify-between gap-4 w-full text-left group"
                        >
                            <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{item.q}</span>
                            {open === i
                                ? <ChevronDown size={14} className="text-gray-500 mt-0.5 shrink-0" />
                                : <ChevronRight size={14} className="text-gray-500 mt-0.5 shrink-0" />
                            }
                        </button>
                        {open === i && (
                            <p className="mt-2 text-sm text-gray-400 leading-relaxed">{item.a}</p>
                        )}
                    </div>
                ))}
            </div>
        </SectionCard>
    );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV_SECTIONS: Section[] = [
    { id: 'getting-started', label: 'Getting Started', icon: <BookOpen size={13} /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={13} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={13} /> },
    { id: 'journal', label: 'Trade Journal', icon: <BookMarked size={13} /> },
    { id: 'strategies', label: 'Strategies', icon: <Target size={13} /> },
    { id: 'performance', label: 'Performance Ledger', icon: <TrendingUp size={13} /> },
    { id: 'accounts', label: 'Accounts & Prop Firms', icon: <Shield size={13} /> },
    { id: 'statistics', label: 'Understanding Statistics', icon: <BarChart2 size={13} /> },
    { id: 'prop-firms', label: 'Prop Firm Reference', icon: <Building2 size={13} /> },
    { id: 'faq', label: 'FAQ', icon: <HelpCircle size={13} /> },
];

function SideNav({ active }: { active: string }) {
    return (
        <nav className="hidden lg:flex flex-col gap-1 sticky top-4 w-52 shrink-0">
            {NAV_SECTIONS.map(s => (
                <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                        active === s.id
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5',
                    )}
                >
                    {s.icon}
                    {s.label}
                </a>
            ))}
        </nav>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function HelpContent() {
    const [firms, setFirms] = useState<PropFirmRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('getting-started');

    useEffect(() => {
        fetch('/api/prop-firms')
            .then(r => r.json())
            .then(d => setFirms(d.propFirms ?? []))
            .catch(() => toast.error('Failed to submit'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const ids = NAV_SECTIONS.map(s => s.id);
        const observer = new IntersectionObserver(
            entries => {
                const visible = entries.filter(e => e.isIntersecting);
                if (visible.length > 0) setActiveSection(visible[0].target.id);
            },
            { rootMargin: '-20% 0px -70% 0px' },
        );
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    return (
        <DashboardShell>
            {/* Page header */}
            <div className="mb-8">
                <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <HelpCircle size={24} className="text-primary" />
                    Help & Reference
                </h1>
                <p className="text-sm text-gray-400 mt-1">Everything you need to get the most out of PrismJournal</p>
            </div>

            <div className="flex gap-8 items-start">
                <SideNav active={activeSection} />

                <div className="flex-1 min-w-0 space-y-6">
                    <GettingStartedSection />
                    <DashboardSection />
                    <AnalyticsSection />
                    <JournalSection />
                    <StrategiesSection />
                    <PerformanceSection />
                    <AccountsSection />
                    <StatisticsSection />
                    <PropFirmSection firms={firms} loading={loading} />
                    <FAQSection />
                </div>
            </div>
        </DashboardShell>
    );
}

export default function HelpPage() {
    return (
        <Suspense fallback={
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        }>
            <HelpContent />
        </Suspense>
    );
}
