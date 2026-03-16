'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
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
    Edit2,
    Archive,
    X,
    Plus,
    Building2,
    ArrowLeft,
    Target,
    DollarSign,
    BarChart3,
    AlertTriangle,
    CheckCircle,
    Calendar,
    ChevronRight,
    Tag,
    Trash2,
    ChevronUp,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { APP_VERSION, versionToPhase } from '@/lib/version';
import PropFirmReferenceTable from '@/components/prop-firm/PropFirmReferenceTable';

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

interface TradingAccount {
    id: string;
    name: string;
    broker: string | null;
    accountNumber: string | null;
    platform: string;
    platformAccountId: string | null;
    currency: string;
    leverage: number;
    accountType: string;
    isActive: boolean;
    currentBalance: number | null;
    currentEquity: number | null;
    tradeCount: number;
    closedTradeCount: number;
    totalPnl: number;
    createdAt: string;
    // Prop firm fields
    propFirmId: string | null;
    propFirm: {
        id: string;
        name: string;
        slug: string;
        challengeType: string;
        dailyLossLimit: number;
        maxDrawdown: number;
        drawdownType: string;
        phasesConfig: string;
    } | null;
    accountSize: number | null;
    profitSplit: number | null;
    allowNewsTrading: boolean | null;
    allowWeekendHolding: boolean | null;
    allowEA: boolean | null;
    // Prop firm rule overrides
    maxDailyLoss: number | null;
    maxTotalDrawdown: number | null;
    profitTarget: number | null;
}

interface PropFirm {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    website: string | null;
    challengeType: string;
    dailyLossLimit: number;
    maxDrawdown: number;
    drawdownType: string;
    allowNewsTrading: boolean;
    allowWeekendHolding: boolean;
    allowEA: boolean;
    phasesConfig: string;
    hasScalingPlan: boolean;
    scalingConfig: string | null;
    popularity: number;
}

interface BridgeKeyInfo {
    bridgeKey: string | null;
    bridgeKeyId: string | null;
    isHashed: boolean;
    syncUrl: string;
}

const PLATFORM_LABELS: Record<string, string> = {
    METATRADER5: 'MT5',
    CTRADER: 'cTrader',
    TRADINGVIEW: 'TradingView',
    MANUAL: 'Manual',
};

const PLATFORM_COLORS: Record<string, string> = {
    METATRADER5: 'bg-orange-500/20 text-orange-400',
    CTRADER: 'bg-blue-500/20 text-blue-400',
    TRADINGVIEW: 'bg-green-500/20 text-green-400',
    MANUAL: 'bg-gray-500/20 text-gray-400',
};

function SettingsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(tabParam || 'connectors');

    // Update active tab when URL param changes
    useEffect(() => {
        if (tabParam && ['connectors', 'preferences', 'notifications', 'security', 'accounts', 'tags'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

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

    // Accounts state
    const [accounts, setAccounts] = useState<TradingAccount[]>([]);
    const [bridgeInfo, setBridgeInfo] = useState<BridgeKeyInfo | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [newBridgeKey, setNewBridgeKey] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editBroker, setEditBroker] = useState('');
    const [accountsSaving, setAccountsSaving] = useState(false);
    // Prop firm rule override edit state
    const [editMaxDailyLoss, setEditMaxDailyLoss] = useState<string>('');
    const [editMaxDrawdown, setEditMaxDrawdown] = useState<string>('');
    const [editProfitTarget, setEditProfitTarget] = useState<string>('');
    
    // Prop firms state
    const [propFirms, setPropFirms] = useState<PropFirm[]>([]);
    const [propFirmsLoading, setPropFirmsLoading] = useState(true);
    const [propFirmsExpanded, setPropFirmsExpanded] = useState(false);
    
    // Add account modal state
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [newAccount, setNewAccount] = useState<{
        name: string;
        broker: string;
        platform: 'METATRADER5' | 'CTRADER' | 'TRADINGVIEW' | 'MANUAL';
        platformAccountId: string;
        accountType: 'PROPFIRM' | 'OWN_MONEY';
        propFirmId: string;
        accountSize: string;
        currency: string;
    }>({
        name: '',
        broker: '',
        platform: 'METATRADER5',
        platformAccountId: '',
        accountType: 'OWN_MONEY',
        propFirmId: '',
        accountSize: '',
        currency: 'USD',
    });
    const [addingAccount, setAddingAccount] = useState(false);

    // Tags state
    const [tags, setTags] = useState<{ id: string; name: string; color: string; tradeCount: number }[]>([]);
    const [tagsLoading, setTagsLoading] = useState(true);
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editingTagName, setEditingTagName] = useState('');
    const [editingTagColor, setEditingTagColor] = useState('#00f2ff');
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#00f2ff');
    const [addingTag, setAddingTag] = useState(false);

    // Inline account detail state
    const [viewingAccountId, setViewingAccountId] = useState<string | null>(null);
    const [viewingAccountDetails, setViewingAccountDetails] = useState<any | null>(null);
    const [viewingAccountLoading, setViewingAccountLoading] = useState(false);

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
            .then((data: BridgeKeyInfo) => {
                setBridgeInfo(data);
                if (data.bridgeKey) setBridgeKey(data.bridgeKey);
                if (data.syncUrl) setSyncUrl(data.syncUrl);
            })
            .catch(() => {});

        loadAccountsData();
        loadPropFirms();
        loadTags();
    }, []);
    
    const loadAccountDetails = async (accountId: string) => {
        setViewingAccountLoading(true);
        setViewingAccountDetails(null);
        try {
            const res = await fetch(`/api/accounts/${accountId}/details?_t=${Date.now()}`, {
                cache: 'no-store',
            });
            if (res.ok) {
                const data = await res.json();
                setViewingAccountDetails(data.account);
            }
        } catch {
            // ignore
        } finally {
            setViewingAccountLoading(false);
        }
    };

    const handleViewAccount = (accountId: string) => {
        setViewingAccountId(accountId);
        loadAccountDetails(accountId);
    };

    const handleBackToAccounts = () => {
        setViewingAccountId(null);
        setViewingAccountDetails(null);
    };

    const loadPropFirms = async () => {
        try {
            const res = await fetch('/api/prop-firms');
            if (res.ok) {
                const data = await res.json();
                setPropFirms(data.propFirms);
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setPropFirmsLoading(false);
        }
    };

    const loadTags = async () => {
        try {
            const res = await fetch('/api/tags');
            if (res.ok) {
                const data = await res.json();
                setTags(data.tags);
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setTagsLoading(false);
        }
    };

    const loadAccountsData = async () => {
        try {
            const [accountsRes, bridgeRes] = await Promise.all([
                fetch('/api/accounts'),
                fetch('/api/account/bridge'),
            ]);
            
            if (accountsRes.ok) {
                const data = await accountsRes.json();
                setAccounts(data.accounts);
            }
            
            if (bridgeRes.ok) {
                const data = await bridgeRes.json();
                setBridgeInfo(data);
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setAccountsLoading(false);
        }
    };

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

    const handleRegenerateKey = async () => {
        if (!confirm('Are you sure? This will invalidate your current bridge key. You\'ll need to update your EA/cBot configuration.')) {
            return;
        }
        
        setRegenerating(true);
        try {
            const res = await fetch('/api/account/bridge', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setNewBridgeKey(data.bridgeKey);
                setBridgeInfo(prev => prev ? {
                    ...prev,
                    bridgeKeyId: data.bridgeKeyId,
                    isHashed: true,
                } : null);
            }
        } catch (error) {
            // error handled by loading state
        } finally {
            setRegenerating(false);
        }
    };

    const handleStartEdit = (account: TradingAccount) => {
        setEditingId(account.id);
        setEditName(account.name);
        setEditBroker(account.broker || '');
        // Set prop firm rule overrides
        setEditMaxDailyLoss(account.maxDailyLoss?.toString() || '');
        setEditMaxDrawdown(account.maxTotalDrawdown?.toString() || '');
        setEditProfitTarget(account.profitTarget?.toString() || '');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditBroker('');
        setEditMaxDailyLoss('');
        setEditMaxDrawdown('');
        setEditProfitTarget('');
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        
        setAccountsSaving(true);
        try {
            const res = await fetch(`/api/accounts/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName,
                    broker: editBroker || null,
                    // Prop firm rule overrides
                    maxDailyLoss: editMaxDailyLoss ? parseFloat(editMaxDailyLoss) : null,
                    maxTotalDrawdown: editMaxDrawdown ? parseFloat(editMaxDrawdown) : null,
                    profitTarget: editProfitTarget ? parseFloat(editProfitTarget) : null,
                }),
            });
            
            if (res.ok) {
                setAccounts(prev => prev.map(a =>
                    a.id === editingId
                        ? {
                            ...a,
                            name: editName,
                            broker: editBroker || null,
                            maxDailyLoss: editMaxDailyLoss ? parseFloat(editMaxDailyLoss) : null,
                            maxTotalDrawdown: editMaxDrawdown ? parseFloat(editMaxDrawdown) : null,
                            profitTarget: editProfitTarget ? parseFloat(editProfitTarget) : null,
                        }
                        : a
                ));
                setEditingId(null);
            }
        } catch (error) {
            // error handled by saving state
        } finally {
            setAccountsSaving(false);
        }
    };

    const handleArchive = async (accountId: string) => {
        if (!confirm('Are you sure you want to archive this account? It will no longer appear in your active accounts.')) {
            return;
        }
        
        try {
            console.log('[handleArchive] Archiving account:', accountId);
            const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
            console.log('[handleArchive] Response status:', res.status);
            
            if (res.ok) {
                const data = await res.json();
                console.log('[handleArchive] Success:', data);
                // Reload accounts to reflect the change
                await loadAccountsData();
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[handleArchive] Failed:', errorData);
                alert(`Failed to archive account: ${errorData.error || 'Please try again.'}`);
            }
        } catch (error) {
            console.error('[handleArchive] Error:', error);
            alert('An error occurred while archiving the account.');
        }
    };

    const formatCurrency = (value: number | null | undefined, currency: string | null | undefined) => {
        const safeValue = value ?? 0;
        const safeCurrency = currency ?? 'USD';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: safeCurrency,
        }).format(safeValue);
    };

    const tabs = [
        { id: 'connectors', label: 'Connector Hub', icon: LinkIcon },
        { id: 'preferences', label: 'Preferences', icon: Globe },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'accounts', label: 'Accounts', icon: Wallet },
        { id: 'tags', label: 'Tags', icon: Tag },
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
                                            Check <span className="text-white font-bold">"Allow WebRequest for listed URL"</span>
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
                                                {bridgeInfo?.isHashed ? (
                                                    showKey ? (
                                                        <span className="text-yellow-400">Key hidden (hashed) - regenerate to view</span>
                                                    ) : (
                                                        '••••••••••••••••••••••••••••••••'
                                                    )
                                                ) : bridgeKey ? (
                                                    showKey ? bridgeKey : '••••••••••••••••••••••••••••••••'
                                                ) : (
                                                    <span className="text-gray-500">No key set - click Regenerate to create one</span>
                                                )}
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
                                                disabled={!bridgeKey}
                                                className="px-3 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all disabled:opacity-50"
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
                                        <span className="text-primary font-mono"> "PrismSync EA started"</span>. Equity snapshots will sync every 60 seconds
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

                    {activeTab === 'accounts' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Inline Account Detail View */}
                            {viewingAccountId && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleBackToAccounts}
                                            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
                                        >
                                            <ArrowLeft size={16} />
                                        </button>
                                        <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">
                                            {viewingAccountDetails?.name || 'Account Detail'}
                                        </h3>
                                        {viewingAccountDetails?.propFirm && (
                                            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-400">
                                                {viewingAccountDetails.propFirm.name}
                                            </span>
                                        )}
                                    </div>

                                    {viewingAccountLoading ? (
                                        <div className="flex items-center justify-center min-h-[200px]">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        </div>
                                    ) : viewingAccountDetails ? (() => {
                                        const acct = viewingAccountDetails;
                                        const currentPhase = acct.challengePhases?.find((p: any) => p.status === 'IN_PROGRESS');
                                        const phasesConfig = acct.phasesConfig || [];
                                        const accountSize = acct.accountSize || 10000;
                                        const currentBalance = acct.currentBalance || accountSize;
                                        const totalPnl = acct.totalPnl || 0;
                                        const progressPercent = currentPhase?.currentProgress || ((currentBalance - accountSize) / accountSize * 100);
                                        const dailyLossPercent = acct.latestSnapshot?.dailyLossUsed || 0;
                                        const dailyLossLimit = currentPhase?.dailyLossLimit || acct.propFirm?.dailyLossLimit || 5;
                                        const drawdownPercent = acct.latestSnapshot?.currentDrawdown || acct.challengePhases?.[0]?.currentDrawdown || 0;
                                        const maxDrawdown = currentPhase?.maxDrawdown || acct.propFirm?.maxDrawdown || 10;
                                        return (
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                <div className="lg:col-span-2 space-y-6">
                                                    <div className="glass-card p-6 border-white/5">
                                                        <div className="flex items-center justify-between mb-6">
                                                            <h4 className="text-base font-bold text-white flex items-center gap-2">
                                                                <Target size={18} className="text-primary" />
                                                                Challenge Progress
                                                            </h4>
                                                            {currentPhase && (
                                                                <span className={cn("px-3 py-1 rounded-lg text-xs font-bold", currentPhase.status === 'IN_PROGRESS' && "bg-blue-500/20 text-blue-400", currentPhase.status === 'PASSED' && "bg-green-500/20 text-green-400", currentPhase.status === 'FAILED' && "bg-red-500/20 text-red-400")}>{currentPhase.phaseName}</span>
                                                            )}
                                                        </div>
                                                        <div className="mb-6">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-sm text-gray-400">Profit Target Progress</span>
                                                                <span className="text-sm font-bold text-white">{progressPercent.toFixed(2)}% / {(currentPhase?.profitTarget || 10)}%</span>
                                                            </div>
                                                            <div className="h-4 bg-black/40 rounded-full overflow-hidden">
                                                                <div className={cn("h-full rounded-full transition-all duration-500", progressPercent >= (currentPhase?.profitTarget || 10) ? "bg-green-500" : "bg-gradient-to-r from-primary to-blue-400")} style={{ width: `${Math.min(100, (progressPercent / (currentPhase?.profitTarget || 10)) * 100)}%` }} />
                                                            </div>
                                                            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                                                <span>${totalPnl.toFixed(2)} realized</span>
                                                                <span>Target: ${((currentPhase?.profitTargetAmount || (accountSize * (currentPhase?.profitTarget || 10) / 100))).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs text-gray-400 uppercase tracking-wider">Daily Loss Used</span>
                                                                    <span className={cn("text-sm font-bold", dailyLossPercent >= dailyLossLimit * 0.8 ? "text-red-400" : "text-white")}>{dailyLossPercent.toFixed(2)}%</span>
                                                                </div>
                                                                <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                                                                    <div className={cn("h-full rounded-full transition-all", dailyLossPercent >= dailyLossLimit ? "bg-red-500" : dailyLossPercent >= dailyLossLimit * 0.8 ? "bg-orange-500" : "bg-yellow-500")} style={{ width: `${Math.min(100, (dailyLossPercent / dailyLossLimit) * 100)}%` }} />
                                                                </div>
                                                                <p className="text-xs text-gray-500 mt-2">Limit: {dailyLossLimit}%</p>
                                                            </div>
                                                            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs text-gray-400 uppercase tracking-wider">Current Drawdown</span>
                                                                    <span className={cn("text-sm font-bold", drawdownPercent >= maxDrawdown * 0.8 ? "text-red-400" : "text-white")}>{drawdownPercent.toFixed(2)}%</span>
                                                                </div>
                                                                <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                                                                    <div className={cn("h-full rounded-full transition-all", drawdownPercent >= maxDrawdown ? "bg-red-500" : drawdownPercent >= maxDrawdown * 0.8 ? "bg-orange-500" : "bg-green-500")} style={{ width: `${Math.min(100, (drawdownPercent / maxDrawdown) * 100)}%` }} />
                                                                </div>
                                                                <p className="text-xs text-gray-500 mt-2">Limit: {maxDrawdown}%</p>
                                                            </div>
                                                        </div>
                                                        {currentPhase?.minTradingDays && (
                                                            <div className="mt-4 p-4 rounded-xl bg-black/20 border border-white/5">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2"><Calendar size={16} className="text-gray-400" /><span className="text-sm text-gray-400">Trading Days</span></div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-lg font-bold text-white">{currentPhase.tradingDaysCount}</span>
                                                                        <span className="text-sm text-gray-400">/ {currentPhase.minTradingDays} minimum</span>
                                                                        {currentPhase.tradingDaysCount >= currentPhase.minTradingDays && <CheckCircle size={16} className="text-green-400" />}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {phasesConfig.length > 0 && (
                                                        <div className="glass-card p-6 border-white/5">
                                                            <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-primary" />Challenge Phases</h4>
                                                            <div className="space-y-3">
                                                                {phasesConfig.map((phase: any) => {
                                                                    const dbPhase = acct.challengePhases?.find((p: any) => p.phaseNumber === phase.phaseNumber);
                                                                    const isActive = dbPhase?.status === 'IN_PROGRESS';
                                                                    const isPassed = dbPhase?.status === 'PASSED';
                                                                    const isFailed = dbPhase?.status === 'FAILED';
                                                                    return (
                                                                        <div key={phase.phaseNumber} className={cn("p-4 rounded-xl border transition-all", isActive && "border-primary/50 bg-primary/5", isPassed && "border-green-500/30 bg-green-500/5", isFailed && "border-red-500/30 bg-red-500/5", !isActive && !isPassed && !isFailed && "border-white/5 bg-black/20")}>
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold", isActive && "bg-primary text-white", isPassed && "bg-green-500 text-white", isFailed && "bg-red-500 text-white", !isActive && !isPassed && !isFailed && "bg-gray-700 text-gray-400")}>{phase.phaseNumber}</div>
                                                                                    <div>
                                                                                        <p className="font-bold text-white">{phase.phaseName}</p>
                                                                                        <p className="text-xs text-gray-400">Target: {phase.profitTarget}% • DD: {phase.maxDrawdown}%</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    {isPassed && <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400">Passed</span>}
                                                                                    {isFailed && <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400">Failed</span>}
                                                                                    {isActive && <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400">In Progress</span>}
                                                                                    {!isActive && !isPassed && !isFailed && dbPhase && <ChevronRight size={16} className="text-gray-500" />}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-6">
                                                    <div className="glass-card p-6 border-white/5">
                                                        <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2"><DollarSign size={18} className="text-primary" />Account Stats</h4>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Account Size</span><span className="font-bold text-white">${accountSize.toLocaleString()}</span></div>
                                                            <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Current Balance</span><span className="font-bold text-white">${currentBalance.toLocaleString()}</span></div>
                                                            <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Total P&L</span><span className={cn("font-bold", totalPnl >= 0 ? "text-green-400" : "text-red-400")}>${totalPnl.toFixed(2)}</span></div>
                                                            <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Profit Split</span><span className="font-bold text-green-400">{acct.profitSplit || 80}%</span></div>
                                                            <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Total Trades</span><span className="font-bold text-white">{acct.tradeCount}</span></div>
                                                        </div>
                                                    </div>
                                                    {acct.propFirm && (
                                                        <div className="glass-card p-6 border-white/5">
                                                            <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Shield size={18} className="text-primary" />Trading Rules</h4>
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">Daily Loss Limit</span><span className="text-orange-400 font-bold">{acct.propFirm.dailyLossLimit}%</span></div>
                                                                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">Max Drawdown</span><span className="text-orange-400 font-bold">{acct.propFirm.maxDrawdown}%</span></div>
                                                                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">Drawdown Type</span><span className="text-white">{acct.propFirm.drawdownType}</span></div>
                                                                <hr className="border-white/5" />
                                                                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">News Trading</span><span className={acct.propFirm.allowNewsTrading ? "text-green-400" : "text-red-400"}>{acct.propFirm.allowNewsTrading ? "Allowed" : "Restricted"}</span></div>
                                                                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">Weekend Holding</span><span className={acct.propFirm.allowWeekendHolding ? "text-green-400" : "text-red-400"}>{acct.propFirm.allowWeekendHolding ? "Allowed" : "Restricted"}</span></div>
                                                                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">EA Trading</span><span className={acct.propFirm.allowEA ? "text-green-400" : "text-red-400"}>{acct.propFirm.allowEA ? "Allowed" : "Restricted"}</span></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="glass-card p-6 border-white/5">
                                                        <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-primary" />Recent Violations</h4>
                                                        {!acct.violations?.length ? (
                                                            <div className="text-center py-4"><CheckCircle size={28} className="mx-auto text-green-400 mb-2" /><p className="text-sm text-gray-400">No violations recorded</p></div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {acct.violations.slice(0, 5).map((v: any) => (
                                                                    <div key={v.id} className={cn("p-3 rounded-lg border", v.severity === 'WARNING' ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" : v.severity === 'CRITICAL' ? "text-orange-400 bg-orange-500/10 border-orange-500/30" : "text-red-400 bg-red-500/10 border-red-500/30")}>
                                                                        <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold uppercase">{v.ruleType.replace(/_/g, ' ')}</span><span className="text-xs text-gray-400">{new Date(v.occurredAt).toLocaleDateString()}</span></div>
                                                                        <p className="text-xs text-gray-300">{v.description}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })() : (
                                        <p className="text-gray-400 text-sm">Failed to load account details.</p>
                                    )}
                                </div>
                            )}

                            {/* Header */}
                            {!viewingAccountId && <div>
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">
                                    Trading Accounts
                                </h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                                    Manage your connected trading accounts
                                </p>
                            </div>}

                            {!viewingAccountId && (accountsLoading ? (
                                <div className="flex items-center justify-center min-h-[200px]">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : (
                                <>
                                    {/* Add Account Modal */}
                                    {showAddAccount && (
                                        <div className="glass-card p-6 border-white/5 bg-white/5 mb-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500">
                                                    Add New Account
                                                </h4>
                                                <button
                                                    onClick={() => setShowAddAccount(false)}
                                                    className="p-1 rounded hover:bg-white/5 transition-all"
                                                >
                                                    <X size={16} className="text-gray-500" />
                                                </button>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                        Account Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newAccount.name}
                                                        onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                                                        placeholder="e.g., FTMO Challenge $100K"
                                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                    />
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                        Broker
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newAccount.broker}
                                                        onChange={(e) => setNewAccount(prev => ({ ...prev, broker: e.target.value }))}
                                                        placeholder="e.g., IC Markets"
                                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                    />
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                        Platform
                                                    </label>
                                                    <select
                                                        value={newAccount.platform}
                                                        onChange={(e) => setNewAccount(prev => ({ ...prev, platform: e.target.value as any }))}
                                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                                    >
                                                        <option value="METATRADER5">MetaTrader 5</option>
                                                        <option value="CTRADER">cTrader</option>
                                                        <option value="TRADINGVIEW">TradingView</option>
                                                        <option value="MANUAL">Manual</option>
                                                    </select>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                        Platform Account ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newAccount.platformAccountId}
                                                        onChange={(e) => setNewAccount(prev => ({ ...prev, platformAccountId: e.target.value }))}
                                                        placeholder="e.g., MT5 login ID or cTrader account"
                                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                    />
                                                    <p className="text-[9px] text-gray-600">The account number from your trading platform (used for sync)</p>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                        Account Type
                                                    </label>
                                                    <select
                                                        value={newAccount.accountType}
                                                        onChange={(e) => setNewAccount(prev => ({ ...prev, accountType: e.target.value as any }))}
                                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                                    >
                                                        <option value="OWN_MONEY">Own Money</option>
                                                        <option value="PROPFIRM">Prop Firm</option>
                                                    </select>
                                                </div>
                                                
                                                {newAccount.accountType === 'PROPFIRM' && (
                                                    <>
                                                        <div className="space-y-2">
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                                Prop Firm
                                                            </label>
                                                            <select
                                                                value={newAccount.propFirmId}
                                                                onChange={(e) => setNewAccount(prev => ({ ...prev, propFirmId: e.target.value }))}
                                                                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                                            >
                                                                <option value="">Select a prop firm...</option>
                                                                {propFirms.map((firm) => (
                                                                    <option key={firm.id} value={firm.id}>
                                                                        {firm.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        
                                                        <div className="space-y-2">
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                                Account Size
                                                            </label>
                                                            <select
                                                                value={newAccount.accountSize}
                                                                onChange={(e) => setNewAccount(prev => ({ ...prev, accountSize: e.target.value }))}
                                                                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                                            >
                                                                <option value="">Select size...</option>
                                                                <option value="5000">$5,000</option>
                                                                <option value="10000">$10,000</option>
                                                                <option value="25000">$25,000</option>
                                                                <option value="50000">$50,000</option>
                                                                <option value="100000">$100,000</option>
                                                                <option value="200000">$200,000</option>
                                                                <option value="300000">$300,000</option>
                                                                <option value="custom">Custom...</option>
                                                            </select>
                                                        </div>
                                                        {newAccount.accountSize === 'custom' && (
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                                    Custom Amount ($)
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    onChange={(e) => setNewAccount(prev => ({ ...prev, accountSize: e.target.value }))}
                                                                    placeholder="Enter custom amount"
                                                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                        Currency
                                                    </label>
                                                    <select
                                                        value={newAccount.currency}
                                                        onChange={(e) => setNewAccount(prev => ({ ...prev, currency: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all"
                                                    >
                                                        <option value="USD">USD</option>
                                                        <option value="EUR">EUR</option>
                                                        <option value="GBP">GBP</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-end gap-3 mt-6">
                                                <button
                                                    onClick={() => setShowAddAccount(false)}
                                                    className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-xs font-bold uppercase hover:bg-white/5 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!newAccount.name.trim()) return;
                                                        
                                                        setAddingAccount(true);
                                                        try {
                                                            const res = await fetch('/api/accounts', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    name: newAccount.name,
                                                                    broker: newAccount.broker || undefined,
                                                                    platform: newAccount.platform,
                                                                    platformAccountId: newAccount.platformAccountId || undefined,
                                                                    accountType: newAccount.accountType,
                                                                    propFirmId: newAccount.propFirmId || undefined,
                                                                    accountSize: newAccount.accountSize ? parseFloat(newAccount.accountSize) : undefined,
                                                                    currency: newAccount.currency,
                                                                }),
                                                            });
                                                            
                                                            if (res.ok) {
                                                                const data = await res.json();
                                                                setAccounts(prev => [...prev, data.account]);
                                                                setShowAddAccount(false);
                                                                setNewAccount({
                                                                    name: '',
                                                                    broker: '',
                                                                    platform: 'METATRADER5',
                                                                    platformAccountId: '',
                                                                    accountType: 'OWN_MONEY',
                                                                    propFirmId: '',
                                                                    accountSize: '',
                                                                    currency: 'USD',
                                                                });
                                                            }
                                                        } catch (error) {
                                                            // error handled by loading state
                                                        } finally {
                                                            setAddingAccount(false);
                                                        }
                                                    }}
                                                    disabled={addingAccount || !newAccount.name.trim()}
                                                    className="px-4 py-2 rounded-lg bg-primary text-black text-xs font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {addingAccount ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <Plus size={14} />
                                                    )}
                                                    Add Account
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Accounts List */}
                                    <div className="glass-card p-6 border-white/5 bg-white/5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500">
                                                Connected Accounts
                                            </h4>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setShowAddAccount(true)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wide hover:bg-primary/20 transition-all"
                                                >
                                                    <Plus size={12} />
                                                    Add Account
                                                </button>
                                                <span className="text-xs text-gray-500">
                                                    {accounts.filter(a => a.isActive).length} active
                                                </span>
                                            </div>
                                        </div>

                                        {accounts.length === 0 ? (
                                            <div className="text-center py-8">
                                                <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                                <p className="text-gray-400 text-sm">No accounts yet</p>
                                                <p className="text-gray-500 text-xs mt-1 mb-4">
                                                    Create an account manually or sync from MT5/cTrader
                                                </p>
                                                <button
                                                    onClick={() => setShowAddAccount(true)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-xs font-bold uppercase hover:brightness-110 transition-all"
                                                >
                                                    <Plus size={14} />
                                                    Add Your First Account
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {accounts.map((account) => (
                                                    <div
                                                        key={account.id}
                                                        className={cn(
                                                            "glass-card p-4 border-white/5 bg-black/20",
                                                            !account.isActive && "opacity-50"
                                                        )}
                                                    >
                                                        {editingId === account.id ? (
                                                            // Edit mode
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex-1">
                                                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 block mb-1">
                                                                            Name
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={editName}
                                                                            onChange={(e) => setEditName(e.target.value)}
                                                                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 block mb-1">
                                                                            Broker
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={editBroker}
                                                                            onChange={(e) => setEditBroker(e.target.value)}
                                                                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm"
                                                                            placeholder="Optional"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {/* Prop Firm Rule Overrides */}
                                                                {account.propFirm && (
                                                                    <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                                                                        <div className="text-[9px] font-black uppercase tracking-widest text-purple-400 mb-2">
                                                                            Rule Overrides (leave empty to use prop firm defaults)
                                                                        </div>
                                                                        <div className="grid grid-cols-3 gap-2">
                                                                            <div>
                                                                                <label className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                                                                                    Daily Loss %
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.1"
                                                                                    value={editMaxDailyLoss}
                                                                                    onChange={(e) => setEditMaxDailyLoss(e.target.value)}
                                                                                    className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded text-white text-xs"
                                                                                    placeholder={`Default: ${account.propFirm.dailyLossLimit}%`}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                                                                                    Max DD %
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.1"
                                                                                    value={editMaxDrawdown}
                                                                                    onChange={(e) => setEditMaxDrawdown(e.target.value)}
                                                                                    className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded text-white text-xs"
                                                                                    placeholder={`Default: ${account.propFirm.maxDrawdown}%`}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                                                                                    Target %
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.1"
                                                                                    value={editProfitTarget}
                                                                                    onChange={(e) => setEditProfitTarget(e.target.value)}
                                                                                    className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded text-white text-xs"
                                                                                    placeholder={(() => { try { const p = JSON.parse(account.propFirm.phasesConfig); return `Phase 1: ${p[0]?.profitTarget ?? '?'}%`; } catch { return 'e.g. 10'; } })()}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={handleCancelEdit}
                                                                        className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 text-xs font-bold uppercase"
                                                                    >
                                                                        <X size={14} className="inline mr-1" />
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={handleSaveEdit}
                                                                        disabled={accountsSaving}
                                                                        className="px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-bold uppercase hover:brightness-110 disabled:opacity-50"
                                                                    >
                                                                        {accountsSaving ? (
                                                                            <Loader2 size={14} className="inline animate-spin mr-1" />
                                                                        ) : (
                                                                            <Save size={14} className="inline mr-1" />
                                                                        )}
                                                                        Save
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // View mode
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-white font-bold">{account.name}</span>
                                                                        <span className={cn(
                                                                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                                            PLATFORM_COLORS[account.platform] || PLATFORM_COLORS.MANUAL
                                                                        )}>
                                                                            {PLATFORM_LABELS[account.platform] || account.platform}
                                                                        </span>
                                                                        {account.platformAccountId && (
                                                                            <span className="text-gray-500 text-xs">
                                                                                #{account.platformAccountId}
                                                                            </span>
                                                                        )}
                                                                        {account.propFirm && (
                                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">
                                                                                {account.propFirm.name}
                                                                            </span>
                                                                        )}
                                                                        {!account.isActive && (
                                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400">
                                                                                Archived
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-4 text-xs text-gray-400">
                                                                        {account.broker && (
                                                                            <span>Broker: {account.broker}</span>
                                                                        )}
                                                                        <span>{account.tradeCount} trades</span>
                                                                        <span className={account.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                                            {formatCurrency(account.totalPnl, account.currency)} P&L
                                                                        </span>
                                                                    </div>
                                                                    {/* Prop Firm Rules Summary */}
                                                                    {account.propFirm && (
                                                                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px]">
                                                                            <span className="text-gray-500">
                                                                                Daily Loss: <span className="text-orange-400 font-bold">{account.propFirm.dailyLossLimit}%</span>
                                                                            </span>
                                                                            <span className="text-gray-500">
                                                                                Max DD: <span className="text-orange-400 font-bold">{account.propFirm.maxDrawdown}%</span>
                                                                            </span>
                                                                            {account.accountSize && (
                                                                                <span className="text-gray-500">
                                                                                    Size: <span className="text-white font-bold">{formatCurrency(account.accountSize, account.currency)}</span>
                                                                                </span>
                                                                            )}
                                                                            {account.profitSplit && (
                                                                                <span className="text-gray-500">
                                                                                    Split: <span className="text-green-400 font-bold">{account.profitSplit}%</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {account.propFirm && (
                                                                        <button
                                                                            onClick={() => handleViewAccount(account.id)}
                                                                            className="p-2 rounded-lg border border-purple-500/30 hover:bg-purple-500/10 text-purple-400 transition-all"
                                                                            title="View Challenge Progress"
                                                                        >
                                                                            <Building2 size={14} />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleStartEdit(account)}
                                                                        className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                    {account.isActive && (
                                                                        <button
                                                                            onClick={() => handleArchive(account.id)}
                                                                            className="p-2 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition-all"
                                                                            title="Archive"
                                                                        >
                                                                            <Archive size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ))}

                            {/* Prop Firm Reference */}
                            {propFirms.length > 0 && (
                                <div className="glass-card border-white/5 overflow-hidden">
                                    <button
                                        onClick={() => setPropFirmsExpanded(e => !e)}
                                        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Building2 size={16} className="text-primary" />
                                            <span className="text-xs font-black uppercase tracking-widest text-white">Prop Firm Reference</span>
                                        </div>
                                        {propFirmsExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                    </button>
                                    {propFirmsExpanded && (
                                        <div className="border-t border-white/5 px-6 py-4">
                                            <PropFirmReferenceTable firms={propFirms} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'tags' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">Tag Management</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Organize your trades with custom tags</p>
                            </div>

                            {/* Add new tag */}
                            <div className="glass-card p-6 border-white/5 bg-white/5">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Create New Tag</h4>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="text"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        placeholder="Tag name"
                                        className="flex-1 px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-gray-700"
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={newTagColor}
                                            onChange={(e) => setNewTagColor(e.target.value)}
                                            className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer"
                                        />
                                        <span className="text-[10px] font-mono text-gray-500">{newTagColor}</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!newTagName.trim()) return;
                                            setAddingTag(true);
                                            try {
                                                const res = await fetch('/api/tags', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
                                                });
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    setTags(prev => [...prev, { ...data, tradeCount: 0 }]);
                                                    setNewTagName('');
                                                    setNewTagColor('#00f2ff');
                                                }
                                            } catch (error) {
                                                // error handled by loading state
                                            } finally {
                                                setAddingTag(false);
                                            }
                                        }}
                                        disabled={addingTag || !newTagName.trim()}
                                        className="px-4 py-2 rounded-lg bg-primary text-black text-xs font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {addingTag ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                        Add Tag
                                    </button>
                                </div>
                            </div>

                            {/* Tags list */}
                            <div className="glass-card p-6 border-white/5 bg-white/5">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Your Tags</h4>
                                
                                {tagsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    </div>
                                ) : tags.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <Tag size={32} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No tags yet. Create your first tag above.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {tags.map((tag) => (
                                            <div
                                                key={tag.id}
                                                className="flex items-center justify-between p-3 rounded-lg border border-white/5 hover:border-white/10 transition-all"
                                            >
                                                {editingTagId === tag.id ? (
                                                    <>
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <input
                                                                type="text"
                                                                value={editingTagName}
                                                                onChange={(e) => setEditingTagName(e.target.value)}
                                                                className="flex-1 px-3 py-1 bg-black/40 border border-white/10 rounded text-white text-sm outline-none focus:border-primary/50"
                                                            />
                                                            <input
                                                                type="color"
                                                                value={editingTagColor}
                                                                onChange={(e) => setEditingTagColor(e.target.value)}
                                                                className="w-8 h-8 rounded border border-white/10 cursor-pointer"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-4">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        const res = await fetch(`/api/tags/${tag.id}`, {
                                                                            method: 'PATCH',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ name: editingTagName.trim(), color: editingTagColor }),
                                                                        });
                                                                        if (res.ok) {
                                                                            const data = await res.json();
                                                                            setTags(prev => prev.map(t => t.id === tag.id ? data : t));
                                                                            setEditingTagId(null);
                                                                        }
                                                                    } catch (error) {
                                                                        // error handled
                                                                    }
                                                                }}
                                                                className="p-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-all"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingTagId(null)}
                                                                className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 transition-all"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-4 h-4 rounded-full"
                                                                style={{ backgroundColor: tag.color }}
                                                            />
                                                            <span className="text-white font-medium">{tag.name}</span>
                                                            <span className="text-[10px] text-gray-500 font-mono">
                                                                {tag.tradeCount} trade{tag.tradeCount !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingTagId(tag.id);
                                                                    setEditingTagName(tag.name);
                                                                    setEditingTagColor(tag.color);
                                                                }}
                                                                className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white transition-all"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (!confirm(`Delete tag "${tag.name}"? This will remove it from all trades.`)) return;
                                                                    try {
                                                                        const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
                                                                        if (res.ok) {
                                                                            setTags(prev => prev.filter(t => t.id !== tag.id));
                                                                        }
                                                                    } catch (error) {
                                                                        // error handled
                                                                    }
                                                                }}
                                                                className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
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

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardShell>
        }>
            <SettingsContent />
        </Suspense>
    );
}
