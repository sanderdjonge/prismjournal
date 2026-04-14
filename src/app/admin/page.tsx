'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { formatDistanceToNow, formatShortDate } from '@/lib/formatTime';
import {
    Shield,
    Users,
    UserCheck,
    UserX,
    Crown,
    Mail,
    Calendar,
    Key,
    Loader2,
    AlertTriangle,
    Server,
    Database,
    HardDrive,
    Activity,
    Trash2,
    Search,
    RefreshCw,
    Download,
    Upload,
    Settings,
    Clock,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle,
    XCircle,
    Send,
    ScrollText,
    Filter,
    ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/formatNumber';
import { apiFetch, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import { toast } from 'sonner';

// Types
interface User {
    id: string;
    email: string | null;
    name: string | null;
    username: string | null;
    isActive: boolean;
    isSuperuser: boolean;
    totpEnabled: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    _count: {
        accounts: number;
        strategies: number;
    };
}

interface InfrastructureData {
    database: {
        sizeMb: number;
        tables: Record<string, number>;
    };
    storage: {
        totalMb: number;
        screenshots: number;
        byType: Record<string, number>;
    };
    health: {
        apiLatencyMs: number;
        dbLatencyMs: number;
        uptimeSeconds: number;
        memoryUsedMb: number;
        memoryTotalMb: number;
    };
    activity: {
        activeSessions24h: number;
        loginsToday: number;
        failedLogins24h: number;
    };
    errors: {
        recentErrors: Array<{ action: string; details: string; createdAt: string }>;
        failedSyncs24h: number;
        errorRate24h: number;
    };
}

interface BackupFile {
    name: string;
    sizeMb: number;
    createdAt: string;
}

interface BackupData {
    status: {
        lastBackup: string | null;
        totalBackups: number;
        totalSizeMb: number;
    };
    config: {
        keepHourly: number;
        keepDaily: number;
        keepWeekly: number;
    };
    backups: {
        hourly: BackupFile[];
        daily: BackupFile[];
        weekly: BackupFile[];
    };
}

type TabType = 'users' | 'infrastructure' | 'backups' | 'broadcast' | 'auditlog' | 'invites';

interface AuditEntry {
    id: string;
    action: string;
    details: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    userId: string | null;
    userEmail: string | null;
    userName: string | null;
    createdAt: string;
}

interface AuditLogData {
    entries: AuditEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    actionTypes: string[];
}

// Format uptime
function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}



export default function AdminPage() {
    const router = useRouter();
    
    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('users');
    
    // Users state
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [resetLoading, setResetLoading] = useState<string | null>(null);
    const [resetSuccess, setResetSuccess] = useState<string | null>(null);

    // Infrastructure state
    const [infraData, setInfraData] = useState<InfrastructureData | null>(null);
    const [infraLoading, setInfraLoading] = useState(false);
    const [infraError, setInfraError] = useState<string | null>(null);
    
    // Backups state
    const [backupData, setBackupData] = useState<BackupData | null>(null);
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupError, setBackupError] = useState<string | null>(null);
    const [backupActionLoading, setBackupActionLoading] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState({
        hourly: false,
        daily: true,  // default collapsed
        weekly: true, // default collapsed
    });

    // Broadcast state
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastType, setBroadcastType] = useState<'INFO' | 'WARNING' | 'SUCCESS'>('INFO');
    const [broadcastLoading, setBroadcastLoading] = useState(false);
    const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

    // Audit log state
    const [auditData, setAuditData] = useState<AuditLogData | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditPage, setAuditPage] = useState(1);
    const [auditActionFilter, setAuditActionFilter] = useState('');
    const [auditSearch, setAuditSearch] = useState('');
    
    // Toggle backup section collapse
    function toggleBackupSection(section: 'hourly' | 'daily' | 'weekly') {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    }
    
    // Initial load
    useEffect(() => {
        loadUsers();
    }, []);
    
    // Load data when tab changes
    useEffect(() => {
        if (activeTab === 'infrastructure' && !infraData) {
            loadInfrastructure();
        } else if (activeTab === 'backups' && !backupData) {
            loadBackups();
        } else if (activeTab === 'auditlog') {
            loadAuditLog(1, auditActionFilter, auditSearch);
        }
    }, [activeTab]);
    
    // Users functions
    async function loadUsers() {
        setUsersLoading(true);
        try {
            const data = await apiFetch<any>(`/api/admin/users?includeInactive=true`);
            setUsers(data.users || []);
        } catch (e: any) {
            if (e?.statusCode === 403) {
                setUsersError('Access denied. Admin privileges required.');
                return;
            }
            setUsersError(e.message || 'Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    }
    
    async function updateUser(userId: string, action: 'makeAdmin' | 'removeAdmin' | 'activate' | 'deactivate') {
        setUpdating(userId);
        try {
            const data = await apiPatch<any>('/api/admin/users', { userId, action });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u));
        } catch (e: any) {
            toast.error(e.message || 'Failed to update user');
        } finally {
            setUpdating(null);
        }
    }
    
    async function deleteUser(userId: string) {
        setUpdating(userId);
        try {
            await apiDelete(`/api/admin/users?userId=${userId}&mode=hard`);
            setUsers(prev => prev.filter(u => u.id !== userId));
            setConfirmDelete(null);
        } catch (e: any) {
            toast.error(e.message || 'Failed to delete user');
        } finally {
            setUpdating(null);
        }
    }

    async function bulkDeleteUsers() {
        setBulkDeleting(true);
        try {
            const selectedArr = Array.from(selectedUsers);
            const results = await Promise.allSettled(
                selectedArr.map(userId =>
                    apiDelete(`/api/admin/users?userId=${userId}&mode=hard`)
                        .then(() => ({ userId, ok: true }))
                        .catch(() => ({ userId, ok: false }))
                )
            );
            const succeeded = new Set<string>();
            let failCount = 0;
            results.forEach((r, i) => {
                if (r.status === 'fulfilled' && r.value.ok) {
                    succeeded.add(r.value.userId);
                } else {
                    failCount++;
                }
            });
            setUsers(prev => prev.filter(u => !succeeded.has(u.id)));
            const newSelected = new Set(selectedUsers);
            succeeded.forEach(id => newSelected.delete(id));
            setSelectedUsers(newSelected);
            setConfirmBulkDelete(false);
            if (failCount > 0) toast.error(`${failCount} user(s) failed to delete`);
        } catch (e: any) {
            toast.error(e.message || 'Bulk delete failed');
        } finally {
            setBulkDeleting(false);
        }
    }

    function toggleUserSelect(userId: string) {
        setSelectedUsers(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    }

    function toggleSelectAll() {
        if (selectedUsers.size === filteredUsers.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
        }
    }
    
    async function sendResetEmail(userId: string, email: string | null) {
        setResetLoading(userId);
        setResetSuccess(null);
        try {
            await apiPost('/api/admin/users', { userId });
            setResetSuccess(`Reset email sent to ${email}`);
            setTimeout(() => setResetSuccess(null), 5000);
        } catch (e: any) {
            toast.error(e.message || 'Failed to send reset email');
        } finally {
            setResetLoading(null);
        }
    }

    async function sendBroadcast() {
        if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
            toast.error('Title and message are required')
            return
        }
        setBroadcastLoading(true)
        setBroadcastResult(null)
        try {
            const data = await apiPost<any>('/api/admin/notifications/broadcast', { title: broadcastTitle, message: broadcastMessage, type: broadcastType })
            setBroadcastResult(data.message)
            setBroadcastTitle('')
            setBroadcastMessage('')
        } catch (e: any) {
            toast.error(e.message || 'Failed to send broadcast')
        } finally {
            setBroadcastLoading(false)
        }
    }

    // Infrastructure functions
    const loadInfrastructure = useCallback(async () => {
        setInfraLoading(true)
        setInfraError(null)
        try {
            const data = await apiFetch<InfrastructureData>('/api/admin/infrastructure')
            setInfraData(data)
        } catch (e: any) {
            setInfraError(e.message || 'Failed to load infrastructure data')
        } finally {
            setInfraLoading(false)
        }
    }, [])
    
    // Backups functions
    const loadBackups = useCallback(async () => {
        setBackupLoading(true)
        setBackupError(null)
        try {
            const data = await apiFetch<BackupData>('/api/admin/backups')
            setBackupData(data)
        } catch (e: any) {
            setBackupError(e.message || 'Failed to load backup data')
        } finally {
            setBackupLoading(false)
        }
    }, [])
    
    async function createBackup() {
        setBackupActionLoading(true)
        try {
            await apiPost('/api/admin/backups', { action: 'create' })
            await loadBackups()
            toast.success('Backup created successfully!')
        } catch (e: any) {
            toast.error(e.message || 'Failed to create backup')
        } finally {
            setBackupActionLoading(false)
        }
    }
    
    // Audit log functions
    async function loadAuditLog(page = 1, action = '', search = '') {
        setAuditLoading(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: '50' })
            if (action) params.set('action', action)
            if (search) params.set('search', search)
            const data = await apiFetch<AuditLogData>(`/api/admin/audit-log?${params}`)
            setAuditData(data)
            setAuditPage(page)
        } catch {
        } finally {
            setAuditLoading(false)
        }
    }

    // Filter users by search
    const filteredUsers = users.filter(user => {
        if (!showInactive && !user.isActive) return false;
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            user.email?.toLowerCase().includes(query) ||
            user.name?.toLowerCase().includes(query) ||
            user.username?.toLowerCase().includes(query)
        );
    });

    const activeCount = users.filter(u => u.isActive).length;
    const inactiveCount = users.length - activeCount;
    const adminCount = users.filter(u => u.isSuperuser).length;
    const twoFACount = users.filter(u => u.totpEnabled).length;
    
    // Loading state
    if (usersLoading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 size={32} className="text-primary animate-spin" />
                </div>
            </DashboardShell>
        );
    }
    
    // Error state
    if (usersError) {
        return (
            <DashboardShell>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <AlertTriangle size={48} className="text-danger" />
                    <p className="text-danger text-sm font-bold">{usersError}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </DashboardShell>
        );
    }
    
    return (
        <DashboardShell>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
                        <Shield size={28} className="text-danger" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Admin Portal</h1>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">System Administration & Management</p>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2 border-b border-white/10 pb-2">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-bold transition-all",
                            activeTab === 'users'
                                ? "bg-white/10 text-white border-b-2 border-primary"
                                : "text-gray-500 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Users size={16} />
                        Users
                    </button>
                    <button
                        onClick={() => setActiveTab('infrastructure')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-bold transition-all",
                            activeTab === 'infrastructure'
                                ? "bg-white/10 text-white border-b-2 border-primary"
                                : "text-gray-500 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Server size={16} />
                        Infrastructure
                    </button>
                    <button
                        onClick={() => setActiveTab('backups')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-bold transition-all",
                            activeTab === 'backups'
                                ? "bg-white/10 text-white border-b-2 border-primary"
                                : "text-gray-500 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Database size={16} />
                        Backups
                    </button>
                    <button
                        onClick={() => setActiveTab('broadcast')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-bold transition-all",
                            activeTab === 'broadcast'
                                ? "bg-white/10 text-white border-b-2 border-primary"
                                : "text-gray-500 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Send size={16} />
                        Broadcast
                    </button>
                    <button
                        onClick={() => { setActiveTab('auditlog'); loadAuditLog(1, auditActionFilter, auditSearch); }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-bold transition-all",
                            activeTab === 'auditlog'
                                ? "bg-white/10 text-white border-b-2 border-primary"
                                : "text-gray-500 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <ScrollText size={16} />
                        Audit Log
                    </button>
                    <button
                        onClick={() => setActiveTab('invites')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-bold transition-all",
                            activeTab === 'invites'
                                ? "bg-white/10 text-white border-b-2 border-primary"
                                : "text-gray-500 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Mail size={16} />
                        Invites
                    </button>
                </div>
                
                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <div className="flex items-center gap-3">
                                    <Users size={20} className="text-primary" />
                                    <div>
                                        <p className="text-lg font-black text-white">
                                            <span className="text-accent">{activeCount}</span>
                                            <span className="text-gray-500 mx-1">/</span>
                                            <span>{users.length}</span>
                                        </p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Active / Total Users</p>
                                    </div>
                                </div>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <div className="flex items-center gap-3">
                                    <UserX size={20} className="text-danger" />
                                    <div>
                                        <p className="text-2xl font-black text-white">{inactiveCount}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Inactive</p>
                                    </div>
                                </div>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <div className="flex items-center gap-3">
                                    <Crown size={20} className="text-yellow-500" />
                                    <div>
                                        <p className="text-2xl font-black text-white">{adminCount}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Admins</p>
                                    </div>
                                </div>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <div className="flex items-center gap-3">
                                    <Key size={20} className="text-primary" />
                                    <div>
                                        <p className="text-2xl font-black text-white">{twoFACount}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">2FA Enabled</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Search & Filter */}
                        <div className="flex gap-3 items-center">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search users by name, email, or username..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
                                />
                            </div>
                            <div className="flex bg-white/5 rounded-xl p-1 shrink-0">
                                <button
                                    onClick={() => setShowInactive(false)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        !showInactive ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-300"
                                    )}
                                >
                                    Active ({activeCount})
                                </button>
                                <button
                                    onClick={() => setShowInactive(true)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        showInactive ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                                    )}
                                >
                                    All ({users.length})
                                </button>
                            </div>
                        </div>

                        {resetSuccess && (
                            <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs font-bold flex items-center gap-2">
                                <CheckCircle size={14} />
                                {resetSuccess}
                            </div>
                        )}

                        {/* Users Table */}
                        <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-black text-white uppercase tracking-tight">User Registry</h2>
                                    {selectedUsers.size > 0 && (
                                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                                            {selectedUsers.size} selected
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedUsers.size > 0 && (
                                        <button
                                            onClick={() => setConfirmBulkDelete(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-[10px] font-black uppercase tracking-widest hover:bg-danger/20 transition-all"
                                        >
                                            <Trash2 size={12} />
                                            Delete ({selectedUsers.size})
                                        </button>
                                    )}
                                    <span className="text-xs text-gray-500">{filteredUsers.length} of {users.length} users</span>
                                </div>
                            </div>

                            {/* Bulk Delete Confirmation */}
                            {confirmBulkDelete && (
                                <div className="p-4 bg-danger/10 border-b border-danger/20 flex items-center justify-between">
                                    <p className="text-sm text-danger font-bold">Permanently delete {selectedUsers.size} user(s)? This cannot be undone.</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={bulkDeleteUsers}
                                            disabled={bulkDeleting}
                                            className="px-4 py-1.5 rounded-lg bg-danger text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
                                        >
                                            {bulkDeleting ? <Loader2 size={12} className="animate-spin inline" /> : 'Confirm'}
                                        </button>
                                        <button
                                            onClick={() => setConfirmBulkDelete(false)}
                                            className="px-4 py-1.5 rounded-lg bg-white/5 text-gray-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.02]">
                                            <th className="p-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="rounded border-white/20 bg-white/5"
                                                />
                                            </th>
                                            <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">User</th>
                                            <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Status</th>
                                            <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Role</th>
                                            <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Security</th>
                                            <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Accounts</th>
                                            <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Joined</th>
                                            <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Last Login</th>
                                            <th className="text-right p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className={cn(
                                                "border-b border-white/5 hover:bg-white/[0.02] transition-all",
                                                selectedUsers.has(user.id) && "bg-primary/5"
                                            )}>
                                                <td className="p-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUsers.has(user.id)}
                                                        onChange={() => toggleUserSelect(user.id)}
                                                        className="rounded border-white/20 bg-white/5"
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                            {(user.name || user.email || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{user.name || 'No name'}</p>
                                                            <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                <Mail size={10} /> {user.email || 'No email'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                        user.isActive
                                                            ? "bg-accent/10 text-accent"
                                                            : "bg-danger/10 text-danger"
                                                    )}>
                                                        {user.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {user.isSuperuser ? (
                                                        <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-500 flex items-center gap-1 w-fit">
                                                            <Crown size={10} /> Admin
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/10 text-gray-500">
                                                            User
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                        user.totpEnabled
                                                            ? "bg-primary/10 text-primary"
                                                            : "bg-white/10 text-gray-500"
                                                    )}>
                                                        {user.totpEnabled ? '2FA On' : '2FA Off'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-sm font-bold text-white">{user._count.accounts}</span>
                                                    <span className="text-[9px] text-gray-500 block">accounts</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Calendar size={10} /> {formatShortDate(user.createdAt)}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Clock size={10} /> {user.lastLoginAt ? formatDistanceToNow(user.lastLoginAt) : 'Never'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {confirmDelete === user.id ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-[10px] text-danger font-bold">Delete?</span>
                                                            <button
                                                                onClick={() => deleteUser(user.id)}
                                                                disabled={updating === user.id}
                                                                className="px-2 py-1 rounded-lg bg-danger text-white text-[9px] font-black uppercase hover:brightness-110 transition-all disabled:opacity-50"
                                                            >
                                                                {updating === user.id ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete(null)}
                                                                className="px-2 py-1 rounded-lg bg-white/5 text-gray-400 text-[9px] font-black uppercase hover:bg-white/10 transition-all"
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => sendResetEmail(user.id, user.email)}
                                                                disabled={resetLoading === user.id}
                                                                className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
                                                                title="Send password reset email"
                                                            >
                                                                {resetLoading === user.id ? (
                                                                    <Loader2 size={14} className="animate-spin" />
                                                                ) : (
                                                                    <Mail size={14} />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => updateUser(user.id, user.isSuperuser ? 'removeAdmin' : 'makeAdmin')}
                                                                disabled={updating === user.id}
                                                                className={cn(
                                                                    "p-2 rounded-lg transition-all disabled:opacity-50",
                                                                    user.isSuperuser
                                                                        ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                                                                        : "bg-white/5 text-gray-500 hover:bg-white/10"
                                                                )}
                                                                title={user.isSuperuser ? 'Remove admin' : 'Make admin'}
                                                            >
                                                                {updating === user.id ? (
                                                                    <Loader2 size={14} className="animate-spin" />
                                                                ) : (
                                                                    <Crown size={14} />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => updateUser(user.id, user.isActive ? 'deactivate' : 'activate')}
                                                                disabled={updating === user.id}
                                                                className={cn(
                                                                    "p-2 rounded-lg transition-all disabled:opacity-50",
                                                                    user.isActive
                                                                        ? "bg-danger/10 text-danger hover:bg-danger/20"
                                                                        : "bg-accent/10 text-accent hover:bg-accent/20"
                                                                )}
                                                                title={user.isActive ? 'Deactivate user' : 'Activate user'}
                                                            >
                                                                {updating === user.id ? (
                                                                    <Loader2 size={14} className="animate-spin" />
                                                                ) : user.isActive ? (
                                                                    <UserX size={14} />
                                                                ) : (
                                                                    <UserCheck size={14} />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete(user.id)}
                                                                disabled={updating === user.id}
                                                                className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-all disabled:opacity-50"
                                                                title="Deactivate user"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Infrastructure Tab */}
                {activeTab === 'infrastructure' && (
                    <div className="space-y-6">
                        {/* Header with refresh */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">System Infrastructure</h2>
                            <button
                                onClick={loadInfrastructure}
                                disabled={infraLoading}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
                            >
                                <RefreshCw size={14} className={infraLoading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>
                        
                        {infraLoading && !infraData ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={24} className="text-primary animate-spin" />
                            </div>
                        ) : infraError ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <AlertCircle size={32} className="text-danger" />
                                <p className="text-danger text-sm">{infraError}</p>
                                <button
                                    onClick={loadInfrastructure}
                                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : infraData ? (
                            <>
                                {/* Health Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="glass-card p-5 border-white/5 bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <Activity size={20} className="text-accent" />
                                            <div>
                                                <p className="text-2xl font-black text-white">{infraData.health.apiLatencyMs}ms</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">API Latency</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-card p-5 border-white/5 bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <Database size={20} className="text-primary" />
                                            <div>
                                                <p className="text-2xl font-black text-white">{infraData.health.dbLatencyMs}ms</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">DB Latency</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-card p-5 border-white/5 bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <Server size={20} className="text-yellow-500" />
                                            <div>
                                                <p className="text-2xl font-black text-white">{formatUptime(infraData.health.uptimeSeconds)}</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Uptime</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-card p-5 border-white/5 bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <HardDrive size={20} className="text-purple-500" />
                                            <div>
                                                <p className="text-2xl font-black text-white">{infraData.health.memoryUsedMb}MB</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Memory Used</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Database & Storage */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Database */}
                                    <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                                        <div className="p-5 border-b border-white/5 flex items-center gap-3">
                                            <Database size={18} className="text-primary" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-tight">Database</h3>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">Total Size</span>
                                                <span className="text-sm font-bold text-white">{infraData.database.sizeMb} MB</span>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Table Row Counts</p>
                                                {Object.entries(infraData.database.tables).map(([table, count]) => (
                                                    <div key={table} className="flex items-center justify-between">
                                                        <span className="text-xs text-gray-400 capitalize">{table}</span>
                                                        <span className="text-sm font-bold text-white">{count.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Storage */}
                                    <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                                        <div className="p-5 border-b border-white/5 flex items-center gap-3">
                                            <HardDrive size={18} className="text-purple-500" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-tight">Storage</h3>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">Total Size</span>
                                                <span className="text-sm font-bold text-white">{infraData.storage.totalMb} MB</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">Screenshots</span>
                                                <span className="text-sm font-bold text-white">{infraData.storage.screenshots}</span>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">By Type</p>
                                                {Object.entries(infraData.storage.byType).map(([type, count]) => (
                                                    <div key={type} className="flex items-center justify-between">
                                                        <span className="text-xs text-gray-400">{type}</span>
                                                        <span className="text-sm font-bold text-white">{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Activity & Errors */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Activity */}
                                    <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                                        <div className="p-5 border-b border-white/5 flex items-center gap-3">
                                            <Activity size={18} className="text-accent" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-tight">User Activity (24h)</h3>
                                        </div>
                                        <div className="p-5 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">Active Sessions</span>
                                                <span className="text-sm font-bold text-white">{infraData.activity.activeSessions24h}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">Logins Today</span>
                                                <span className="text-sm font-bold text-white">{infraData.activity.loginsToday}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">Failed Logins</span>
                                                <span className="text-sm font-bold text-danger">{infraData.activity.failedLogins24h}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Errors */}
                                    <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                                        <div className="p-5 border-b border-white/5 flex items-center gap-3">
                                            <AlertTriangle size={18} className="text-danger" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-tight">Error Tracking</h3>
                                        </div>
                                        <div className="p-5 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">Error Rate (24h)</span>
                                                <span className="text-sm font-bold text-white">{formatPercent(infraData.errors.errorRate24h * 100, 2)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">Failed Syncs</span>
                                                <span className="text-sm font-bold text-danger">{infraData.errors.failedSyncs24h}</span>
                                            </div>
                                            {infraData.errors.recentErrors.length > 0 && (
                                                <div className="space-y-2 mt-4">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Recent Errors</p>
                                                    {infraData.errors.recentErrors.slice(0, 5).map((error, i) => (
                                                        <div key={i} className="text-xs text-gray-400 truncate">
                                                            <span className="text-danger">{error.action}:</span> {error.details}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}
                
                {/* Backups Tab */}
                {activeTab === 'backups' && (
                    <div className="space-y-6">
                        {/* Header with actions */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Database Backups</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={loadBackups}
                                    disabled={backupLoading}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
                                >
                                    <RefreshCw size={14} className={backupLoading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                                <button
                                    onClick={createBackup}
                                    disabled={backupActionLoading}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-sm font-bold"
                                >
                                    {backupActionLoading ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Download size={14} />
                                    )}
                                    Create Backup
                                </button>
                            </div>
                        </div>
                        
                        {backupLoading && !backupData ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={24} className="text-primary animate-spin" />
                            </div>
                        ) : backupError ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <AlertCircle size={32} className="text-danger" />
                                <p className="text-danger text-sm">{backupError}</p>
                                <button
                                    onClick={loadBackups}
                                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : backupData ? (
                            <>
                                {/* Status Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="glass-card p-5 border-white/5 bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <Clock size={20} className="text-primary" />
                                            <div>
                                                <p className="text-sm font-black text-white">
                                                    {backupData.status.lastBackup ? formatDistanceToNow(backupData.status.lastBackup) : 'Never'}
                                                </p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Last Backup</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-card p-5 border-white/5 bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <Database size={20} className="text-accent" />
                                            <div>
                                                <p className="text-2xl font-black text-white">{backupData.status.totalBackups}</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Backups</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-card p-5 border-white/5 bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <HardDrive size={20} className="text-yellow-500" />
                                            <div>
                                                <p className="text-2xl font-black text-white">{backupData.status.totalSizeMb} MB</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Size</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Backup Lists */}
                                <div className="space-y-6">
                                    {/* Hourly */}
                                    <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                                        <div
                                            className="p-4 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all"
                                            onClick={() => toggleBackupSection('hourly')}
                                        >
                                            <div className="flex items-center gap-2">
                                                {collapsedSections.hourly ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                                <Clock size={16} className="text-primary" />
                                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Hourly Backups</h3>
                                                <span className="text-xs text-gray-500">({backupData.backups.hourly.length})</span>
                                            </div>
                                            <span className="text-xs text-gray-500">Keep: {backupData.config.keepHourly}</span>
                                        </div>
                                        {!collapsedSections.hourly && (
                                            <div className="divide-y divide-white/5">
                                                {backupData.backups.hourly.length === 0 ? (
                                                    <p className="p-4 text-xs text-gray-500 text-center">No hourly backups</p>
                                                ) : (
                                                    backupData.backups.hourly.map((backup) => (
                                                        <div key={backup.name} className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{backup.name}</p>
                                                                <p className="text-[10px] text-gray-500">{new Date(backup.createdAt).toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-xs text-gray-400">{backup.sizeMb} MB</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Daily */}
                                    <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                                        <div
                                            className="p-4 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all"
                                            onClick={() => toggleBackupSection('daily')}
                                        >
                                            <div className="flex items-center gap-2">
                                                {collapsedSections.daily ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                                <Calendar size={16} className="text-accent" />
                                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Daily Backups</h3>
                                                <span className="text-xs text-gray-500">({backupData.backups.daily.length})</span>
                                            </div>
                                            <span className="text-xs text-gray-500">Keep: {backupData.config.keepDaily}</span>
                                        </div>
                                        {!collapsedSections.daily && (
                                            <div className="divide-y divide-white/5">
                                                {backupData.backups.daily.length === 0 ? (
                                                    <p className="p-4 text-xs text-gray-500 text-center">No daily backups</p>
                                                ) : (
                                                    backupData.backups.daily.map((backup) => (
                                                        <div key={backup.name} className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{backup.name}</p>
                                                                <p className="text-[10px] text-gray-500">{new Date(backup.createdAt).toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-xs text-gray-400">{backup.sizeMb} MB</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Weekly */}
                                    <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                                        <div
                                            className="p-4 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all"
                                            onClick={() => toggleBackupSection('weekly')}
                                        >
                                            <div className="flex items-center gap-2">
                                                {collapsedSections.weekly ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                                <Database size={16} className="text-yellow-500" />
                                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Weekly Backups</h3>
                                                <span className="text-xs text-gray-500">({backupData.backups.weekly.length})</span>
                                            </div>
                                            <span className="text-xs text-gray-500">Keep: {backupData.config.keepWeekly}</span>
                                        </div>
                                        {!collapsedSections.weekly && (
                                            <div className="divide-y divide-white/5">
                                                {backupData.backups.weekly.length === 0 ? (
                                                    <p className="p-4 text-xs text-gray-500 text-center">No weekly backups</p>
                                                ) : (
                                                    backupData.backups.weekly.map((backup) => (
                                                        <div key={backup.name} className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{backup.name}</p>
                                                                <p className="text-[10px] text-gray-500">{new Date(backup.createdAt).toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-xs text-gray-400">{backup.sizeMb} MB</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}

                {/* Broadcast Tab */}
                {activeTab === 'broadcast' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Broadcast Notification</h2>
                            <p className="text-xs text-gray-500 mt-1">Send an in-app notification to all active users.</p>
                        </div>

                        <div className="glass-card border-white/5 bg-black/40 p-6 space-y-5 max-w-xl">
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Type</label>
                                <div className="flex gap-2">
                                    {(['INFO', 'WARNING', 'SUCCESS'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setBroadcastType(t)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                broadcastType === t
                                                    ? t === 'WARNING' ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                                        : t === 'SUCCESS' ? "bg-accent/20 text-accent border border-accent/30"
                                                        : "bg-primary/20 text-primary border border-primary/30"
                                                    : "bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={broadcastTitle}
                                    onChange={e => setBroadcastTitle(e.target.value)}
                                    maxLength={100}
                                    placeholder="e.g. Scheduled Maintenance"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50"
                                />
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Message</label>
                                <textarea
                                    value={broadcastMessage}
                                    onChange={e => setBroadcastMessage(e.target.value)}
                                    maxLength={500}
                                    rows={4}
                                    placeholder="e.g. PrismJournal will be offline on Sunday 02:00–04:00 UTC for maintenance."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 resize-none"
                                />
                                <p className="text-[9px] text-gray-600 mt-1 text-right">{broadcastMessage.length}/500</p>
                            </div>

                            {broadcastResult && (
                                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs font-bold flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    {broadcastResult}
                                </div>
                            )}

                            <button
                                onClick={sendBroadcast}
                                disabled={broadcastLoading || !broadcastTitle.trim() || !broadcastMessage.trim()}
                                className="w-full p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {broadcastLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                {broadcastLoading ? 'Sending...' : `Send to All Users (${users.filter(u => u.isActive).length})`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Audit Log Tab */}
                {activeTab === 'auditlog' && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="glass-card p-4 border-white/5 bg-white/5 flex flex-wrap gap-3 items-end">
                            <div className="flex items-center gap-2">
                                <Filter size={14} className="text-gray-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Filters</span>
                            </div>
                            <div className="flex-1 min-w-[160px]">
                                <select
                                    value={auditActionFilter}
                                    onChange={e => { setAuditActionFilter(e.target.value); loadAuditLog(1, e.target.value, auditSearch); }}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/50"
                                >
                                    <option value="">All actions</option>
                                    {(auditData?.actionTypes ?? []).map(a => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[160px]">
                                <input
                                    type="text"
                                    placeholder="Search IP address..."
                                    value={auditSearch}
                                    onChange={e => setAuditSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && loadAuditLog(1, auditActionFilter, auditSearch)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
                                />
                            </div>
                            <button
                                onClick={() => loadAuditLog(1, auditActionFilter, auditSearch)}
                                className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
                            >
                                {auditLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                Refresh
                            </button>
                            {auditData && (
                                <span className="text-[10px] text-gray-500 font-mono ml-auto">
                                    {auditData.pagination.total.toLocaleString()} entries
                                </span>
                            )}
                        </div>

                        {/* Table */}
                        <div className="glass-card border-white/5 bg-white/5 overflow-hidden">
                            {auditLoading && !auditData ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 size={24} className="text-primary animate-spin" />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-white/10">
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">Time</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">Action</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">User</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">IP</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {(auditData?.entries ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-12 text-gray-600 text-xs">No audit log entries found.</td>
                                                </tr>
                                            ) : (auditData?.entries ?? []).map(entry => {
                                                const actionColor =
                                                    entry.action.includes('FAIL') || entry.action.includes('ERROR') || entry.action.includes('VIOLATION') || entry.action.includes('DELETE')
                                                        ? 'text-danger'
                                                        : entry.action.includes('LOGIN') || entry.action.includes('SUCCESS')
                                                            ? 'text-accent'
                                                            : 'text-primary';
                                                const detailsStr = typeof entry.details === 'string'
                                                    ? entry.details
                                                    : JSON.stringify(entry.details);
                                                return (
                                                    <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-2.5 text-gray-500 font-mono whitespace-nowrap">
                                                            {new Date(entry.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
                                                        </td>
                                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                                            <span className={cn('font-black text-[10px] uppercase tracking-wide', actionColor)}>
                                                                {entry.action}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                                            {entry.userEmail ? (
                                                                <span className="text-gray-300">{entry.userEmail}</span>
                                                            ) : (
                                                                <span className="text-gray-600 italic">anonymous</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-500 font-mono whitespace-nowrap">
                                                            {entry.ipAddress ?? '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate font-mono">
                                                            {detailsStr}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {auditData && auditData.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => loadAuditLog(auditPage - 1, auditActionFilter, auditSearch)}
                                    disabled={auditPage <= 1 || auditLoading}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                                >
                                    <ChevronLeft size={14} /> Previous
                                </button>
                                <span className="text-[10px] text-gray-500 font-mono">
                                    Page {auditPage} of {auditData.pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => loadAuditLog(auditPage + 1, auditActionFilter, auditSearch)}
                                    disabled={auditPage >= auditData.pagination.totalPages || auditLoading}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Invites Tab */}
                {activeTab === 'invites' && (
                    <InvitesTab />
                )}
            </div>
        </DashboardShell>
    );
}

// Invites Tab Component
function InvitesTab() {
    const [tokens, setTokens] = useState<Array<{
        id: string;
        token: string;
        email: string | null;
        createdBy: string;
        creator: { id: string; name: string | null; email: string | null } | null;
        usedBy: string | null;
        user: { id: string; name: string | null; email: string | null } | null;
        usedAt: string | null;
        expiresAt: string | null;
        createdAt: string;
    }>>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newTokenCount, setNewTokenCount] = useState(1);
    const [expiresDays, setExpiresDays] = useState(7);
    const [newTokens, setNewTokens] = useState<string[]>([]);
    const [inviteOnlyMode, setInviteOnlyMode] = useState(false);
    const [toggleLoading, setToggleLoading] = useState(false);

    const loadTokens = async () => {
        setLoading(true)
        try {
            const data = await apiFetch<any>('/api/admin/invite-tokens')
            setTokens(data.tokens || [])
        } catch {
        }
        setLoading(false)
    }

    const loadInviteOnlyMode = async () => {
        try {
            const data = await apiFetch<any>('/api/admin/system-settings')
            setInviteOnlyMode(data.inviteOnlyMode ?? false)
        } catch {
        }
    }

    useEffect(() => {
        loadTokens()
        loadInviteOnlyMode()
    }, [])

    const toggleInviteOnlyMode = async () => {
        setToggleLoading(true)
        try {
            const data = await apiPatch<any>('/api/admin/system-settings', { inviteOnlyMode: !inviteOnlyMode })
            setInviteOnlyMode(data.inviteOnlyMode ?? false)
        } catch {
        }
        setToggleLoading(false)
    }

    const generateTokens = async () => {
        setGenerating(true)
        setNewTokens([])
        try {
            const data = await apiPost<any>('/api/admin/invite-tokens', { count: newTokenCount, expiresDays })
            setNewTokens(data.tokens || [])
            loadTokens()
        } catch {
        }
        setGenerating(false)
    }

    const deleteToken = async (id: string) => {
        if (!confirm('Delete this token?')) return
        try {
            await apiDelete(`/api/admin/invite-tokens?id=${id}`)
            loadTokens()
        } catch {
        }
    }

    const copyToken = (token: string) => {
        const url = `${window.location.origin}/login?invite=${token}`;
        navigator.clipboard.writeText(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Invite Tokens</h2>
                    <p className="text-xs text-gray-500 mt-1">Generate and manage registration invite tokens</p>
                </div>
            </div>

            {/* Invite-Only Mode Toggle */}
            <div className="glass-card border-white/5 bg-white/5 p-5 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-white">Invite-Only Registration</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        When enabled, new users must provide a valid invite token to register.
                        When disabled, anyone can register freely.
                    </p>
                </div>
                <button
                    onClick={toggleInviteOnlyMode}
                    disabled={toggleLoading}
                    className={cn(
                        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ml-4",
                        inviteOnlyMode ? "bg-primary" : "bg-gray-600"
                    )}
                >
                    {toggleLoading ? (
                        <Loader2 size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                    ) : (
                        <span className={cn(
                            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                            inviteOnlyMode ? "translate-x-6" : "translate-x-1"
                        )} />
                    )}
                </button>
            </div>

            {/* Generate Form */}
            <div className="glass-card border-white/5 bg-white/5 p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">Generate New Tokens</h3>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Count</label>
                        <input
                            type="number"
                            min={1}
                            max={100}
                            value={newTokenCount}
                            onChange={e => setNewTokenCount(parseInt(e.target.value) || 1)}
                            className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Expires (days)</label>
                        <input
                            type="number"
                            min={1}
                            max={365}
                            value={expiresDays}
                            onChange={e => setExpiresDays(parseInt(e.target.value) || 7)}
                            className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        />
                    </div>
                    <button
                        onClick={generateTokens}
                        disabled={generating}
                        className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
                    >
                        {generating ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                        Generate
                    </button>
                </div>

                {/* New Tokens */}
                {newTokens.length > 0 && (
                    <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-lg space-y-2">
                        <p className="text-xs font-bold text-accent">Generated {newTokens.length} token(s):</p>
                        <div className="space-y-1">
                            {newTokens.map((token, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <code className="text-xs text-white font-mono flex-1 bg-black/20 px-2 py-1 rounded">
                                        {window.location.origin}/login?invite={token}
                                    </code>
                                    <button
                                        onClick={() => copyToken(token)}
                                        className="text-xs text-accent hover:underline"
                                    >
                                        Copy
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Tokens List */}
            <div className="glass-card border-white/5 bg-white/5 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={24} className="text-primary animate-spin" />
                    </div>
                ) : tokens.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-xs">No invite tokens yet.</div>
                ) : (
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Token</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Created By</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Used By</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Expires</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {tokens.map(token => (
                                <tr key={token.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-2.5">
                                        <code className="text-gray-300 font-mono">{token.token}</code>
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-400">
                                        {token.creator?.name || token.creator?.email || '—'}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {token.user ? (
                                            <span className="text-accent">{token.user.name || token.user.email}</span>
                                        ) : (
                                            <span className="text-gray-600">Unused</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-500">
                                        {token.expiresAt ? formatShortDate(token.expiresAt) : 'Never'}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => copyToken(token.token)}
                                                className="text-primary hover:underline"
                                            >
                                                Copy
                                            </button>
                                            <button
                                                onClick={() => deleteToken(token.id)}
                                                className="text-danger hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
