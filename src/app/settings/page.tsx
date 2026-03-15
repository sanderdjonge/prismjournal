'use client';

import { useState, useEffect } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import Link from 'next/link';
import {
    Link as LinkIcon,
    Bell,
    Globe,
    Save,
    Download,
    Copy,
    Check,
    RefreshCw,
    Eye,
    EyeOff,
    Send,
    Loader2,
    Shield,
    Smartphone,
    QrCode,
    Key,
    Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { APP_VERSION, versionToPhase } from '@/lib/version';

const CURRENCY_OPTIONS = [
    { label: 'USD - United States Dollar', value: 'USD' },
    { label: 'EUR - Euro', value: 'EUR' },
    { label: 'GBP - British Pound', value: 'GBP' },
];

const TIMEZONE_OPTIONS = [
    { label: '(GMT+01:00) Amsterdam, Berlin, Rome', value: 'Europe/Amsterdam' },
    { label: '(GMT+00:00) London, Lisbon, Dublin', value: 'Europe/London' },
    { label: '(GMT-05:00) Eastern Time (US & Canada)', value: 'America/New_York' },
];

interface NotifState {
    telegramAlerts: boolean;
    weeklyDigest: boolean;
    volatilityWarnings: boolean;
    inAppToast: boolean;
    telegramId: string;
    mddThreshold: string;
    // Email notification settings
    email: string;
    enableWeeklyDigestEmail: boolean;
    enableMddEmailAlerts: boolean;
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('connectors');

    // Preferences state
    const [currency, setCurrency] = useState('USD');
    const [timezone, setTimezone] = useState('Europe/Amsterdam');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Bridge state
    const [bridgeKey, setBridgeKey] = useState('');
    const [syncUrl, setSyncUrl] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState(false);

    // Notifications state
    const [notifs, setNotifs] = useState<NotifState>({
        telegramAlerts: true,
        weeklyDigest: true,
        volatilityWarnings: false,
        inAppToast: true,
        telegramId: '',
        mddThreshold: '',
        // Email notification settings
        email: '',
        enableWeeklyDigestEmail: false,
        enableMddEmailAlerts: false,
    });
    const [testingSend, setTestingSend] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testingEmail, setTestingEmail] = useState(false);
    const [emailTestResult, setEmailTestResult] = useState<string | null>(null);

    // 2FA state
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [show2FASetup, setShow2FASetup] = useState(false);
    const [twoFASecret, setTwoFASecret] = useState<string | null>(null);
    const [twoFAQrCode, setTwoFAQrCode] = useState<string | null>(null);
    const [twoFACode, setTwoFACode] = useState('');
    const [twoFALoading, setTwoFALoading] = useState(false);
    const [twoFAError, setTwoFAError] = useState<string | null>(null);
    const [twoFASuccess, setTwoFASuccess] = useState<string | null>(null);
    const [disable2FAPassword, setDisable2FAPassword] = useState('');
    const [showDisable2FA, setShowDisable2FA] = useState(false);

    useEffect(() => {
        fetch('/api/settings')
            .then((r) => r.json())
            .then((data) => {
                if (data.displayCurrency) setCurrency(data.displayCurrency);
                if (data.timezone) setTimezone(data.timezone);
                if (data.twoFAEnabled !== undefined) setTwoFAEnabled(data.twoFAEnabled);
            })
            .catch(() => {});

        fetch('/api/settings/notifications')
            .then((r) => r.json())
            .then((data) => {
                setNotifs((prev) => ({
                    ...prev,
                    telegramAlerts: data.enableSync ?? prev.telegramAlerts,
                    weeklyDigest: data.enableTrades ?? prev.weeklyDigest,
                    volatilityWarnings: data.enableRisk ?? prev.volatilityWarnings,
                    telegramId: data.telegramId ?? '',
                    mddThreshold: data.mddThreshold?.toString() ?? '',
                    // Email notification settings
                    email: data.email ?? '',
                    enableWeeklyDigestEmail: data.enableWeeklyDigest ?? false,
                    enableMddEmailAlerts: data.enableMddAlerts ?? false,
                }));
            })
            .catch(() => {});

        fetch('/api/account/bridge')
            .then((r) => r.json())
            .then((data) => {
                if (data.bridgeKey) setBridgeKey(data.bridgeKey);
                if (data.syncUrl) setSyncUrl(data.syncUrl);
            })
            .catch(() => {});
    }, []);

    async function handleCopy(text: string, label: string) {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    }

    async function handleRegenerate() {
        if (!confirm('Regenerate your Bridge Key? Your existing MT5 connection will stop working until you update the key in the EA.')) return;
        setRegenerating(true);
        try {
            const res = await fetch('/api/account/bridge', { method: 'POST' });
            const data = await res.json();
            if (data.bridgeKey) setBridgeKey(data.bridgeKey);
        } finally {
            setRegenerating(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            if (activeTab === 'preferences') {
                await fetch('/api/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayCurrency: currency, timezone }),
                });
            } else if (activeTab === 'notifications') {
                await fetch('/api/settings/notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        enableSync: notifs.telegramAlerts,
                        enableTrades: notifs.weeklyDigest,
                        enableRisk: notifs.volatilityWarnings,
                        telegramId: notifs.telegramId.trim() || null,
                        mddThreshold: notifs.mddThreshold ? parseFloat(notifs.mddThreshold) : null,
                        // Email notification settings
                        email: notifs.email.trim() || null,
                        enableWeeklyDigest: notifs.enableWeeklyDigestEmail,
                        enableMddAlerts: notifs.enableMddEmailAlerts,
                    }),
                });
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    }

    const tabs = [
        { id: 'connectors', label: 'Connector Hub', icon: LinkIcon },
        { id: 'preferences', label: 'Preferences', icon: Globe },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
    ];

    type ToggleKey = 'telegramAlerts' | 'weeklyDigest' | 'volatilityWarnings' | 'inAppToast';
    const notifRows: { key: ToggleKey; label: string; desc: string }[] = [
        { key: 'telegramAlerts', label: 'Trade Alerts', desc: 'Real-time trade open/close notifications via Telegram' },
        { key: 'weeklyDigest', label: 'Weekly Performance Digest', desc: 'Summary of your weekly trading edge evolution' },
        { key: 'volatilityWarnings', label: 'Drawdown Alerts', desc: 'Alert when equity drawdown exceeds your threshold' },
        { key: 'inAppToast', label: 'In-app Execution Toast', desc: 'Immediate visual feedback for all trade operations' },
    ];

    const showSaveButton = activeTab === 'preferences' || activeTab === 'notifications';

    return (
        <DashboardShell>
            <div className="flex flex-col lg:flex-row gap-12">
                {/* Internal Settings Navigation */}
                <aside className="w-full lg:w-64 space-y-2 shrink-0">
                    <h2 className="text-xl font-black text-white px-4 mb-6 tracking-tighter uppercase italic">System Config</h2>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border font-bold uppercase tracking-widest text-[10px]",
                                activeTab === tab.id
                                    ? "bg-primary/10 text-primary border-primary/20 shadow-[0_0_15px_rgba(0,242,255,0.1)]"
                                    : "text-gray-500 hover:text-white hover:bg-white/5 border-transparent"
                            )}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                    <Link
                        href="/settings/accounts"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border font-bold uppercase tracking-widest text-[10px] text-gray-500 hover:text-white hover:bg-white/5 border-transparent"
                    >
                        <Wallet size={16} />
                        Accounts
                    </Link>
                </aside>

                {/* Content Area */}
                <main className="flex-1 glass-card bg-black/40 backdrop-blur-md p-10 border-white/5 min-h-[600px] flex flex-col">
                    {activeTab === 'connectors' && (
                        <div className="space-y-10 animate-fade-in">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">MetaTrader 5 Bridge</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Connect your MT5 terminal to sync trades and equity in real-time</p>
                            </div>

                            {/* Step 1: Download EA */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-black">1</div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wide">Download the Expert Advisor</h4>
                                </div>
                                <div className="glass-card p-5 border-white/5 bg-white/5">
                                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                                        Download <span className="text-white font-bold">PrismSync.mq5</span> and place it in your MT5 data folder:
                                    </p>
                                    <div className="glass-card p-3 border-white/5 bg-black/40 font-mono text-[11px] text-gray-400 mb-4">
                                        MT5 &gt; File &gt; Open Data Folder &gt; MQL5 &gt; Experts
                                    </div>
                                    <a
                                        href="/api/account/bridge/download"
                                        download="PrismSync.mq5"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-black uppercase tracking-[0.15em] text-[10px] shadow-[0_0_15px_rgba(0,242,255,0.2)] hover:brightness-110 active:scale-95 transition-all"
                                    >
                                        <Download size={14} /> Download PrismSync.mq5
                                    </a>
                                </div>
                            </div>

                            {/* Step 2: Allow WebRequests */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-black">2</div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wide">Allow WebRequests in MT5</h4>
                                </div>
                                <div className="glass-card p-5 border-white/5 bg-white/5">
                                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                                        In MetaTrader 5, go to <span className="text-white font-bold">Tools &gt; Options &gt; Expert Advisors</span> and:
                                    </p>
                                    <ul className="space-y-2 text-xs text-gray-400">
                                        <li className="flex items-start gap-2">
                                            <span className="text-primary mt-0.5">&#x2022;</span>
                                            Check <span className="text-white font-bold">&quot;Allow WebRequest for listed URL&quot;</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-primary mt-0.5">&#x2022;</span>
                                            Add your Sync URL (shown below) to the allowed list
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Step 3: Configure EA */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-black">3</div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wide">Configure the EA</h4>
                                </div>
                                <div className="glass-card p-5 border-white/5 bg-white/5 space-y-5">
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Drag <span className="text-white font-bold">PrismSync</span> onto any chart. In the EA input parameters, enter the Sync URL and Bridge Key below.
                                    </p>

                                    {/* Sync URL */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Sync URL</label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 glass-card px-4 py-3 border-white/5 bg-black/40 font-mono text-sm text-white truncate">
                                                {syncUrl || 'Loading...'}
                                            </div>
                                            <button
                                                onClick={() => handleCopy(syncUrl, 'url')}
                                                className="px-3 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
                                                title="Copy"
                                            >
                                                {copied === 'url' ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-gray-500" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bridge Key */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Bridge Key</label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 glass-card px-4 py-3 border-white/5 bg-black/40 font-mono text-sm text-white truncate">
                                                {showKey ? (bridgeKey || 'Loading...') : bridgeKey ? '••••••••••••••••••••••••••••••••' : 'Loading...'}
                                            </div>
                                            <button
                                                onClick={() => setShowKey(!showKey)}
                                                className="px-3 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
                                                title={showKey ? 'Hide' : 'Reveal'}
                                            >
                                                {showKey ? <EyeOff size={16} className="text-gray-500" /> : <Eye size={16} className="text-gray-500" />}
                                            </button>
                                            <button
                                                onClick={() => handleCopy(bridgeKey, 'key')}
                                                className="px-3 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
                                                title="Copy"
                                            >
                                                {copied === 'key' ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-gray-500" />}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-[9px] text-gray-600">Keep this key secret. It authenticates your MT5 terminal.</p>
                                            <button
                                                onClick={handleRegenerate}
                                                disabled={regenerating}
                                                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all disabled:opacity-50"
                                            >
                                                <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} /> Regenerate
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 4: Verify */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-black">4</div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wide">Verify Connection</h4>
                                </div>
                                <div className="glass-card p-5 border-white/5 bg-white/5">
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Once the EA is running, check the MT5 <span className="text-white font-bold">Experts</span> tab for
                                        <span className="text-primary font-mono"> &quot;PrismSync EA started&quot;</span>. Equity snapshots will sync every 60 seconds
                                        and trades will appear in your journal automatically.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'preferences' && (
                        <div className="space-y-10 animate-fade-in">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">Preferences</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tailor the Prism interface to your regional requirements</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Base Account Currency</label>
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all appearance-none"
                                    >
                                        {CURRENCY_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">System Timezone</label>
                                    <select
                                        value={timezone}
                                        onChange={(e) => setTimezone(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all appearance-none"
                                    >
                                        {TIMEZONE_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Interface Language</label>
                                    <select className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all appearance-none">
                                        <option>English (Global)</option>
                                        <option>Dutch (Netherlands)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-10 animate-fade-in">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">Notification Matrix</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Configure how and when the system communicates critical events</p>
                            </div>

                            {/* Telegram Connection */}
                            <div className="space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2">Telegram Connection</h4>
                                <div className="glass-card p-6 border-white/5 bg-white/5 space-y-4">
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Open <a href="https://t.me/prismjournal_bot" target="_blank" rel="noopener" className="text-primary font-bold hover:underline">@prismjournal_bot</a> in Telegram, send <span className="font-mono text-white">/start</span> to get your Chat ID, then paste it below.
                                    </p>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Telegram Chat ID</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={notifs.telegramId}
                                                onChange={(e) => setNotifs(prev => ({ ...prev, telegramId: e.target.value }))}
                                                placeholder="e.g. 123456789"
                                                className="flex-1 glass-card px-4 py-3 border-white/5 bg-black/40 font-mono text-sm text-white outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                            />
                                            <button
                                                onClick={async () => {
                                                    setTestingSend(true);
                                                    setTestResult(null);
                                                    try {
                                                        const res = await fetch('/api/telegram/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: notifs.telegramId.trim() }) });
                                                        const data = await res.json();
                                                        setTestResult(data.success ? 'sent' : data.error || 'Failed');
                                                    } catch { setTestResult('Failed'); }
                                                    finally { setTestingSend(false); setTimeout(() => setTestResult(null), 3000); }
                                                }}
                                                disabled={testingSend || !notifs.telegramId}
                                                className="px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all disabled:opacity-40 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white"
                                                title="Send test message"
                                            >
                                                {testingSend ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                Test
                                            </button>
                                        </div>
                                        {testResult === 'sent' && <p className="text-[9px] font-bold text-accent">Test message sent! Check Telegram.</p>}
                                        {testResult && testResult !== 'sent' && <p className="text-[9px] font-bold text-danger">{testResult}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Email Notifications */}
                            <div className="space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2">Email Notifications</h4>
                                <div className="glass-card p-6 border-white/5 bg-white/5 space-y-4">
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Configure your email address to receive weekly performance digests and drawdown alerts.
                                    </p>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Email Address</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="email"
                                                value={notifs.email}
                                                onChange={(e) => setNotifs(prev => ({ ...prev, email: e.target.value }))}
                                                placeholder="your@email.com"
                                                className="flex-1 glass-card px-4 py-3 border-white/5 bg-black/40 text-sm text-white outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                            />
                                            <button
                                                onClick={async () => {
                                                    setTestingEmail(true);
                                                    setEmailTestResult(null);
                                                    try {
                                                        const res = await fetch('/api/settings/notifications', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ email: notifs.email.trim() }),
                                                        });
                                                        const data = await res.json();
                                                        setEmailTestResult(data.success ? 'sent' : data.error || 'Failed');
                                                    } catch { setEmailTestResult('Failed'); }
                                                    finally { setTestingEmail(false); setTimeout(() => setEmailTestResult(null), 3000); }
                                                }}
                                                disabled={testingEmail || !notifs.email}
                                                className="px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all disabled:opacity-40 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white"
                                                title="Send test email"
                                            >
                                                {testingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                Test
                                            </button>
                                        </div>
                                        {emailTestResult === 'sent' && <p className="text-[9px] font-bold text-accent">Test email sent! Check your inbox.</p>}
                                        {emailTestResult && emailTestResult !== 'sent' && <p className="text-[9px] font-bold text-danger">{emailTestResult}</p>}
                                    </div>

                                    {/* Email Alert Toggles */}
                                    <div className="space-y-3 pt-4">
                                        <div className="flex items-center justify-between py-2">
                                            <div>
                                                <h5 className="text-sm font-bold text-white">Weekly Performance Digest</h5>
                                                <p className="text-[10px] text-gray-500">Receive a weekly summary of your trading performance</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <a
                                                    href="/api/cron/digest/preview"
                                                    target="_blank"
                                                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    Preview →
                                                </a>
                                                <button
                                                    onClick={() => setNotifs((prev) => ({ ...prev, enableWeeklyDigestEmail: !prev.enableWeeklyDigestEmail }))}
                                                    className={cn(
                                                        "w-12 h-6 rounded-full transition-all relative shrink-0",
                                                        notifs.enableWeeklyDigestEmail ? "bg-primary/40" : "bg-white/10"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "absolute top-1 w-4 h-4 rounded-full transition-all shadow-lg",
                                                        notifs.enableWeeklyDigestEmail ? "right-1 bg-primary" : "left-1 bg-gray-700"
                                                    )} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <div>
                                                <h5 className="text-sm font-bold text-white">Drawdown Email Alerts</h5>
                                                <p className="text-[10px] text-gray-500">Get email alerts when drawdown exceeds threshold</p>
                                            </div>
                                            <button
                                                onClick={() => setNotifs((prev) => ({ ...prev, enableMddEmailAlerts: !prev.enableMddEmailAlerts }))}
                                                className={cn(
                                                    "w-12 h-6 rounded-full transition-all relative shrink-0",
                                                    notifs.enableMddEmailAlerts ? "bg-primary/40" : "bg-white/10"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-1 w-4 h-4 rounded-full transition-all shadow-lg",
                                                    notifs.enableMddEmailAlerts ? "right-1 bg-primary" : "left-1 bg-gray-700"
                                                )} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Alert Toggles */}
                            <div className="space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2">Alert Types</h4>
                                {notifRows.map((row) => (
                                    <div key={row.key} className="glass-card p-6 border-white/5 bg-white/5 flex items-center justify-between group hover:bg-white/[0.08] transition-all">
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{row.label}</h4>
                                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">{row.desc}</p>
                                        </div>
                                        <button
                                            onClick={() => setNotifs((prev) => ({ ...prev, [row.key]: !prev[row.key] as boolean }))}
                                            className={cn(
                                                "w-12 h-6 rounded-full transition-all relative shrink-0",
                                                notifs[row.key] ? "bg-primary/40" : "bg-white/10"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-1 w-4 h-4 rounded-full transition-all shadow-lg",
                                                notifs[row.key] ? "right-1 bg-primary" : "left-1 bg-gray-700"
                                            )} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Drawdown Threshold */}
                            <div className="space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2">Risk Thresholds</h4>
                                <div className="glass-card p-6 border-white/5 bg-white/5 space-y-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Max Drawdown Alert (%)</label>
                                    <p className="text-[10px] text-gray-500">Get alerted when your equity drawdown exceeds this percentage</p>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="100"
                                        value={notifs.mddThreshold}
                                        onChange={(e) => setNotifs(prev => ({ ...prev, mddThreshold: e.target.value }))}
                                        placeholder="e.g. 5"
                                        className="w-32 glass-card px-4 py-3 border-white/5 bg-black/40 font-mono text-sm text-white outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-10 animate-fade-in">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">Security Settings</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Protect your account with two-factor authentication</p>
                            </div>

                            {/* 2FA Section */}
                            <div className="space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2">Two-Factor Authentication</h4>
                                <div className="glass-card p-6 border-white/5 bg-white/5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Smartphone size={24} className="text-primary" />
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-bold text-white">Authenticator App</h5>
                                                <p className="text-[10px] text-gray-500">
                                                    {twoFAEnabled 
                                                        ? '2FA is currently enabled on your account'
                                                        : 'Use an authenticator app to generate one-time codes'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                                            twoFAEnabled 
                                                ? "bg-accent/10 text-accent" 
                                                : "bg-white/10 text-gray-500"
                                        )}>
                                            {twoFAEnabled ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>

                                    {!show2FASetup && !twoFAEnabled && (
                                        <button
                                            onClick={async () => {
                                                setTwoFALoading(true);
                                                setTwoFAError(null);
                                                try {
                                                    const res = await fetch('/api/2fa/setup', { method: 'POST' });
                                                    const data = await res.json();
                                                    if (data.error) throw new Error(data.error);
                                                    setTwoFASecret(data.secret);
                                                    setTwoFAQrCode(data.qrCode);
                                                    setShow2FASetup(true);
                                                } catch (e: any) {
                                                    setTwoFAError(e.message || 'Failed to setup 2FA');
                                                } finally {
                                                    setTwoFALoading(false);
                                                }
                                            }}
                                            disabled={twoFALoading}
                                            className="w-full p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {twoFALoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                                            {twoFALoading ? 'Loading...' : 'Enable Two-Factor Authentication'}
                                        </button>
                                    )}

                                    {show2FASetup && twoFAQrCode && (
                                        <div className="space-y-4 pt-4 border-t border-white/10">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="p-4 bg-white rounded-xl">
                                                    <img src={twoFAQrCode} alt="2FA QR Code" className="w-40 h-40" />
                                                </div>
                                                <p className="text-[10px] text-gray-500 text-center">
                                                    Scan this QR code with your authenticator app
                                                </p>
                                                <div className="text-xs font-mono text-gray-400 bg-black/40 px-3 py-1.5 rounded-lg">
                                                    Secret: {twoFASecret}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Verification Code</label>
                                                <input
                                                    type="text"
                                                    value={twoFACode}
                                                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="Enter 6-digit code"
                                                    className="w-full glass-card px-4 py-3 border-white/5 bg-black/40 font-mono text-lg text-white text-center tracking-[0.5em] outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                />
                                            </div>

                                            {twoFAError && <p className="text-danger text-[10px] text-center">{twoFAError}</p>}
                                            {twoFASuccess && <p className="text-accent text-[10px] text-center">{twoFASuccess}</p>}

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        setShow2FASetup(false);
                                                        setTwoFASecret(null);
                                                        setTwoFAQrCode(null);
                                                        setTwoFACode('');
                                                        setTwoFAError(null);
                                                    }}
                                                    className="flex-1 p-3 rounded-xl border border-white/10 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (twoFACode.length !== 6) {
                                                            setTwoFAError('Please enter a 6-digit code');
                                                            return;
                                                        }
                                                        setTwoFALoading(true);
                                                        setTwoFAError(null);
                                                        try {
                                                            const res = await fetch('/api/2fa/verify', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ code: twoFACode }),
                                                            });
                                                            const data = await res.json();
                                                            if (data.error) throw new Error(data.error);
                                                            setTwoFAEnabled(true);
                                                            setShow2FASetup(false);
                                                            setTwoFASuccess('Two-factor authentication enabled successfully!');
                                                            setTimeout(() => setTwoFASuccess(null), 3000);
                                                        } catch (e: any) {
                                                            setTwoFAError(e.message || 'Invalid code');
                                                        } finally {
                                                            setTwoFALoading(false);
                                                        }
                                                    }}
                                                    disabled={twoFALoading || twoFACode.length !== 6}
                                                    className="flex-1 p-3 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {twoFALoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                                    Verify & Enable
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {twoFAEnabled && !showDisable2FA && (
                                        <button
                                            onClick={() => setShowDisable2FA(true)}
                                            className="w-full p-3 rounded-xl border border-danger/30 text-danger text-[10px] font-black uppercase tracking-widest hover:bg-danger/10 transition-all"
                                        >
                                            Disable Two-Factor Authentication
                                        </button>
                                    )}

                                    {showDisable2FA && (
                                        <div className="space-y-4 pt-4 border-t border-white/10">
                                            <p className="text-xs text-gray-400">
                                                Enter your password to disable 2FA
                                            </p>
                                            <input
                                                type="password"
                                                value={disable2FAPassword}
                                                onChange={(e) => setDisable2FAPassword(e.target.value)}
                                                placeholder="Enter your password"
                                                className="w-full glass-card px-4 py-3 border-white/5 bg-black/40 text-sm text-white outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                            />
                                            {twoFAError && <p className="text-danger text-[10px]">{twoFAError}</p>}
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        setShowDisable2FA(false);
                                                        setDisable2FAPassword('');
                                                        setTwoFAError(null);
                                                    }}
                                                    className="flex-1 p-3 rounded-xl border border-white/10 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!disable2FAPassword) {
                                                            setTwoFAError('Password is required');
                                                            return;
                                                        }
                                                        setTwoFALoading(true);
                                                        setTwoFAError(null);
                                                        try {
                                                            const res = await fetch('/api/2fa/disable', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ password: disable2FAPassword }),
                                                            });
                                                            const data = await res.json();
                                                            if (data.error) throw new Error(data.error);
                                                            setTwoFAEnabled(false);
                                                            setShowDisable2FA(false);
                                                            setDisable2FAPassword('');
                                                            setTwoFASuccess('Two-factor authentication disabled');
                                                            setTimeout(() => setTwoFASuccess(null), 3000);
                                                        } catch (e: any) {
                                                            setTwoFAError(e.message || 'Failed to disable 2FA');
                                                        } finally {
                                                            setTwoFALoading(false);
                                                        }
                                                    }}
                                                    disabled={twoFALoading || !disable2FAPassword}
                                                    className="flex-1 p-3 rounded-xl bg-danger text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {twoFALoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                                    Disable 2FA
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Password Section */}
                            <div className="space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2">Password</h4>
                                <div className="glass-card p-6 border-white/5 bg-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                                            <Key size={24} className="text-gray-400" />
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-bold text-white">Change Password</h5>
                                            <p className="text-[10px] text-gray-500">Update your account password</p>
                                        </div>
                                    </div>
                                    <button className="px-4 py-2 rounded-xl border border-white/10 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                                        Change
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showSaveButton && (
                        <div className="mt-auto pt-10 flex items-center gap-4 border-t border-white/5">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Save size={14} /> {saving ? 'Saving...' : 'Synchronize All Changes'}
                            </button>
                            {saved && (
                                <span className="text-primary text-[10px] font-black uppercase tracking-widest animate-fade-in">Saved!</span>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Version footer */}
            <div className="mt-16 pt-6 border-t border-white/5 text-center">
                <p className="text-[11px] text-gray-600 font-mono tracking-widest uppercase">
                    PrismJournal v{APP_VERSION} — {versionToPhase(APP_VERSION)}
                </p>
            </div>
        </DashboardShell>
    );
}
