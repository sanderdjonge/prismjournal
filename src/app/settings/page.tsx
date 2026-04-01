'use client';

import { useState, useEffect, Suspense } from 'react';
import QRCode from 'qrcode';
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
    Share2,
    ExternalLink,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { APP_VERSION, versionToPhase } from '@/lib/version';
import PropFirmReferenceTable from '@/components/prop-firm/PropFirmReferenceTable';
import { useCurrency } from '@/lib/currency';
import { useQueryClient } from '@tanstack/react-query';

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

const DATE_FORMAT_OPTIONS = [
    { label: 'DD-MM-YYYY (European)', value: 'DD-MM-YYYY' },
    { label: 'MM-DD-YYYY (American)', value: 'MM-DD-YYYY' },
    { label: 'YYYY-MM-DD (ISO)', value: 'YYYY-MM-DD' },
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
    digestFrequency: 'DAILY' | 'WEEKLY';
    digestSendHour: number;
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
        phasesConfig: unknown;
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
    phasesConfig: unknown;
    hasScalingPlan: boolean;
    scalingConfig: unknown;
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
    TRADINGVIEW: 'bg-profit/20 text-profit',
    MANUAL: 'bg-gray-500/20 text-gray-400',
};

function SettingsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(tabParam || 'preferences');
    const { setCurrency: setCurrencyContext } = useCurrency();
    const queryClient = useQueryClient();

    // Update active tab when URL param changes
    useEffect(() => {
        if (tabParam && ['preferences', 'notifications', 'security', 'tags'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    // Preferences state
    const [currency, setCurrency] = useState('USD');
    const [timezone, setTimezone] = useState('Europe/Amsterdam');
    const [dateFormat, setDateFormat] = useState('DD-MM-YYYY');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

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
        digestFrequency: 'WEEKLY' as const,
        digestSendHour: 9,
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

    // Public profile / widget state
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileEnabled, setProfileEnabled] = useState(false);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [profileStats, setProfileStats] = useState({
        showWinRate: true,
        showEquityCurve: true,
        showPrismScore: false,
    });
    const [widgetPreviewKey, setWidgetPreviewKey] = useState(0);
    const [urlCopied, setUrlCopied] = useState(false);
    const [embedCopied, setEmbedCopied] = useState(false);

    useEffect(() => {
        fetch('/api/settings')
            .then((r) => r.json())
            .then((data) => {
                if (data.displayCurrency) setCurrency(data.displayCurrency);
                if (data.timezone) setTimezone(data.timezone);
                if (data.dateFormat) setDateFormat(data.dateFormat);
                if (data.twoFAEnabled !== undefined) setTwoFAEnabled(data.twoFAEnabled);
            })
            .catch(() => {});

        fetch('/api/settings/notifications')
            .then((r) => { if (!r.ok) throw new Error('not ok'); return r.json(); })
            .then((data) => {
                setNotifs((prev) => ({
                    ...prev,
                    telegramAlerts: data.enableSync ?? prev.telegramAlerts,
                    weeklyDigest: data.enableTrades ?? prev.weeklyDigest,
                    volatilityWarnings: data.enableRisk ?? prev.volatilityWarnings,
                    telegramId: data.telegramId ?? '',
                    mddThreshold: data.mddThreshold?.toString() ?? '',
                    email: data.email ?? '',
                    enableWeeklyDigestEmail: data.enableWeeklyDigest ?? false,
                    enableMddEmailAlerts: data.enableMddAlerts ?? false,
                    digestFrequency: (data.digestFrequency ?? 'WEEKLY') as 'DAILY' | 'WEEKLY',
                    digestSendHour: data.digestSendHour ?? 9,
                    inAppToast: data.inAppToast ?? true,
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

    // Load public profile settings when switching to sharing tab
    useEffect(() => {
        if (activeTab !== 'sharing' || profileLoading || profileId !== null) return;
        setProfileLoading(true);
        fetch('/api/settings/profile')
            .then(r => r.json())
            .then(data => {
                setProfileEnabled(data.publicProfileEnabled ?? false);
                setProfileId(data.publicProfileId ?? null);
                setProfileStats(data.publicProfileStats ?? { showWinRate: true, showEquityCurve: true, showPrismScore: false });
            })
            .catch(() => {})
            .finally(() => setProfileLoading(false));
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleToggleProfile(enabled: boolean) {
        setProfileSaving(true);
        try {
            const res = await fetch('/api/settings/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicProfileEnabled: enabled }),
            });
            const data = await res.json();
            setProfileEnabled(data.publicProfileEnabled);
            setProfileId(data.publicProfileId ?? null);
            if (enabled) setWidgetPreviewKey(k => k + 1);
        } catch { /* ignore */ } finally { setProfileSaving(false); }
    }

    async function handleUpdateProfileStats(stats: typeof profileStats) {
        setProfileStats(stats);
        setProfileSaving(true);
        try {
            await fetch('/api/settings/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicProfileStats: stats }),
            });
            setWidgetPreviewKey(k => k + 1);
        } catch { /* ignore */ } finally { setProfileSaving(false); }
    }

    function getWidgetUrl() {
        if (!profileId) return '';
        return `${window.location.origin}/api/public/${profileId}/widget.png`;
    }

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
        setSaveError(null);
        try {
            if (activeTab === 'preferences') {
                await fetch('/api/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayCurrency: currency, timezone, dateFormat }),
                });
                setCurrencyContext(currency);
                queryClient.invalidateQueries({ queryKey: ['settings'] });
            } else if (activeTab === 'notifications') {
                const res = await fetch('/api/settings/notifications', {
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
                        digestFrequency: notifs.digestFrequency,
                        digestSendHour: notifs.digestSendHour,
                        inAppToast: notifs.inAppToast,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error || `Failed to save notification settings (${res.status})`);
                }
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
            setTimeout(() => setSaveError(null), 4000);
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
        { id: 'preferences', label: 'Preferences', icon: Globe },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'tags', label: 'Tags', icon: Tag },
        { id: 'sharing', label: 'Sharing', icon: Share2 },
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
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Date Format</label>
                                    <select
                                        value={dateFormat}
                                        onChange={(e) => setDateFormat(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all appearance-none"
                                    >
                                        {DATE_FORMAT_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
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
                                                <h5 className="text-sm font-bold text-white">Performance Digest Email</h5>
                                                <p className="text-[10px] text-gray-500">Receive a summary of your trading performance by email</p>
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
                                        {notifs.enableWeeklyDigestEmail && (
                                            <div className="ml-0 pl-4 border-l border-white/5 space-y-3 pb-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Frequency</label>
                                                        <div className="flex gap-2">
                                                            {(['DAILY', 'WEEKLY'] as const).map((f) => (
                                                                <button
                                                                    key={f}
                                                                    type="button"
                                                                    onClick={() => setNotifs(prev => ({ ...prev, digestFrequency: f }))}
                                                                    className={cn(
                                                                        "px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-all",
                                                                        notifs.digestFrequency === f
                                                                            ? "bg-primary/10 border-primary/30 text-primary"
                                                                            : "bg-black/20 border-white/10 text-gray-500 hover:text-white"
                                                                    )}
                                                                >
                                                                    {f === 'DAILY' ? 'Daily' : 'Weekly (Mon)'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Send at</label>
                                                        <select
                                                            value={notifs.digestSendHour}
                                                            onChange={(e) => setNotifs(prev => ({ ...prev, digestSendHour: parseInt(e.target.value) }))}
                                                            className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs outline-none focus:border-primary/50 transition-all"
                                                        >
                                                            {Array.from({ length: 24 }, (_, utcHour) => {
                                                                // Convert UTC hour to user's local time for display
                                                                const d = new Date();
                                                                d.setUTCHours(utcHour, 0, 0, 0);
                                                                const localLabel = d.toLocaleTimeString('en-GB', {
                                                                    timeZone: timezone,
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                    hour12: false,
                                                                });
                                                                return { utcHour, localLabel };
                                                            })
                                                                .sort((a, b) => a.localLabel.localeCompare(b.localLabel))
                                                                .map(({ utcHour, localLabel }) => (
                                                                    <option key={utcHour} value={utcHour}>
                                                                        {localLabel}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
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
                                                    const qrUrl = await QRCode.toDataURL(data.provisioning_uri);
                                                    setTwoFAQrCode(qrUrl);
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
                                                                className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-loss/10 hover:border-loss/30 hover:text-loss transition-all"
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

                    {activeTab === 'sharing' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">Public Profile & Widget</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Share your trading stats with an embeddable performance card</p>
                            </div>

                            {profileLoading ? (
                                <div className="flex items-center gap-3 text-gray-500">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Loading…</span>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Enable toggle */}
                                    <div className="flex items-center justify-between p-5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                                        <div>
                                            <p className="text-sm font-bold text-white">Enable Public Profile</p>
                                            <p className="text-[10px] text-gray-500 mt-0.5">Generates a shareable widget image with your trading stats</p>
                                        </div>
                                        <button
                                            onClick={() => handleToggleProfile(!profileEnabled)}
                                            disabled={profileSaving}
                                            className="shrink-0 disabled:opacity-50"
                                            title={profileEnabled ? 'Disable public profile' : 'Enable public profile'}
                                        >
                                            {profileEnabled
                                                ? <ToggleRight size={36} className="text-primary" />
                                                : <ToggleLeft size={36} className="text-gray-600" />}
                                        </button>
                                    </div>

                                    {profileEnabled && (
                                        <>
                                            {/* Stat toggles */}
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Visible on Widget</p>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {([
                                                        { key: 'showWinRate', label: 'Win Rate' },
                                                        { key: 'showEquityCurve', label: 'Equity Curve' },
                                                        { key: 'showPrismScore', label: 'Prism Score' },
                                                    ] as { key: keyof typeof profileStats; label: string }[]).map(({ key, label }) => (
                                                        <button
                                                            key={key}
                                                            onClick={() => handleUpdateProfileStats({ ...profileStats, [key]: !profileStats[key] })}
                                                            disabled={profileSaving}
                                                            className={cn(
                                                                'flex items-center gap-3 p-4 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all text-left disabled:opacity-50',
                                                                profileStats[key]
                                                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                                                    : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:bg-white/[0.05]'
                                                            )}
                                                        >
                                                            {profileStats[key] ? <CheckCircle size={14} /> : <Eye size={14} />}
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Widget preview */}
                                            {profileId && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Widget Preview</p>
                                                        <button
                                                            onClick={() => setWidgetPreviewKey(k => k + 1)}
                                                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                                                        >
                                                            <RefreshCw size={11} /> Refresh
                                                        </button>
                                                    </div>

                                                    {/* Preview image — 300×200 rendered at 1:1 */}
                                                    <div className="inline-block rounded-xl overflow-hidden border border-white/10">
                                                        <img
                                                            key={widgetPreviewKey}
                                                            src={`/api/public/${profileId}/widget.png?t=${widgetPreviewKey}`}
                                                            alt="Widget preview"
                                                            style={{ width: 300, height: 200, display: 'block' }}
                                                        />
                                                    </div>

                                                    {/* Widget URL */}
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Widget URL</p>
                                                        <div className="flex gap-2">
                                                            <input
                                                                readOnly
                                                                value={getWidgetUrl()}
                                                                className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-xs font-mono text-gray-300 outline-none select-all"
                                                            />
                                                            <button
                                                                onClick={async () => {
                                                                    await navigator.clipboard.writeText(getWidgetUrl());
                                                                    setUrlCopied(true);
                                                                    setTimeout(() => setUrlCopied(false), 2000);
                                                                }}
                                                                className="px-4 py-3 bg-white/[0.05] border border-white/[0.06] rounded-xl hover:bg-white/10 transition-colors"
                                                                title="Copy URL"
                                                            >
                                                                {urlCopied ? <Check size={14} className="text-primary" /> : <Copy size={14} className="text-gray-400" />}
                                                            </button>
                                                            <a
                                                                href={getWidgetUrl()}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-4 py-3 bg-white/[0.05] border border-white/[0.06] rounded-xl hover:bg-white/10 transition-colors"
                                                                title="Open in new tab"
                                                            >
                                                                <ExternalLink size={14} className="text-gray-400" />
                                                            </a>
                                                        </div>
                                                    </div>

                                                    {/* Embed code */}
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">HTML Embed Code</p>
                                                        <div className="relative">
                                                            <pre className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-[11px] font-mono text-gray-400 overflow-x-auto whitespace-pre-wrap">
{`<a href="https://prismjournal.app" target="_blank">
  <img src="${getWidgetUrl()}"
       alt="My Trading Performance"
       width="300" height="200" />
</a>`}
                                                            </pre>
                                                            <button
                                                                onClick={async () => {
                                                                    const code = `<a href="https://prismjournal.app" target="_blank">\n  <img src="${getWidgetUrl()}"\n       alt="My Trading Performance"\n       width="300" height="200" />\n</a>`;
                                                                    await navigator.clipboard.writeText(code);
                                                                    setEmbedCopied(true);
                                                                    setTimeout(() => setEmbedCopied(false), 2000);
                                                                }}
                                                                className="absolute top-3 right-3 p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                                                                title="Copy embed code"
                                                            >
                                                                {embedCopied ? <Check size={12} className="text-primary" /> : <Copy size={12} className="text-gray-400" />}
                                                            </button>
                                                        </div>
                                                        <p className="text-[9px] text-gray-600 uppercase tracking-wider">Widget updates automatically every 24 hours via daily cron</p>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
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
                            {saveError && (
                                <span className="text-red-400 text-[10px] font-black uppercase tracking-widest animate-fade-in">{saveError}</span>
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
