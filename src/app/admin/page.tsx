'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
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

type TabType = 'users' | 'infrastructure' | 'backups' | 'broadcast' | 'auditlog';

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

// Format date relative
function formatRelative(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
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
            loadAuditLog(auditPage, auditActionFilter, auditSearch);
        }
    }, [activeTab]);
    
    // Users functions
    async function loadUsers() {
        setUsersLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.status === 403) {
                setUsersError('Access denied. Admin privileges required.');
                return;
            }
            if (!res.ok) throw new Error('Failed to load users');
            const data = await res.json();
            setUsers(data.users || []);
        } catch (e: any) {
            setUsersError(e.message || 'Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    }
    
    async function updateUser(userId: string, action: 'makeAdmin' | 'removeAdmin' | 'activate' | 'deactivate') {
        setUpdating(userId);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, action }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update user');
            }
            const data = await res.json();
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u));
        } catch (e: any) {
            console.error('Failed to update user:', e);
            alert(e.message || 'Failed to update user');
        } finally {
            setUpdating(null);
        }
    }
    
    async function deleteUser(userId: string) {
        if (!confirm('Are you sure you want to delete this user? This will deactivate their account.')) {
            setDeleteConfirm(null);
            return;
        }
        
        setUpdating(userId);
        try {
            const res = await fetch(`/api/admin/users?userId=${userId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete user');
            }
            setUsers(prev => prev.filter(u => u.id !== userId));
            setDeleteConfirm(null);
        } catch (e: any) {
            console.error('Failed to delete user:', e);
            alert(e.message || 'Failed to delete user');
        } finally {
            setUpdating(null);
        }
    }
    
    async function sendResetEmail(userId: string, email: string | null) {
        setResetLoading(userId);
        setResetSuccess(null);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Request failed (${res.status})`);
            }
            const data = await res.json();
            setResetSuccess(`Reset email sent to ${email}`);
            setTimeout(() => setResetSuccess(null), 5000);
        } catch (e: any) {
            alert(e.message || 'Failed to send reset email');
        } finally {
            setResetLoading(null);
        }
    }

    async function sendBroadcast() {
        if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
            alert('Title and message are required');
            return;
        }
        setBroadcastLoading(true);
        setBroadcastResult(null);
        try {
            const res = await fetch('/api/admin/notifications/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: broadcastTitle, message: broadcastMessage, type: broadcastType }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send broadcast');
            setBroadcastResult(data.message);
            setBroadcastTitle('');
            setBroadcastMessage('');
        } catch (e: any) {
            alert(e.message || 'Failed to send broadcast');
        } finally {
            setBroadcastLoading(false);
        }
    }

    // Infrastructure functions
    const loadInfrastructure = useCallback(async () => {
        setInfraLoading(true);
        setInfraError(null);
        try {
            const res = await fetch('/api/admin/infrastructure');
            if (!res.ok) throw new Error('Failed to load infrastructure data');
            const data = await res.json();
            setInfraData(data);
        } catch (e: any) {
            setInfraError(e.message || 'Failed to load infrastructure data');
        } finally {
            setInfraLoading(false);
        }
    }, []);
    
    // Backups functions
    const loadBackups = useCallback(async () => {
        setBackupLoading(true);
        setBackupError(null);
        try {
            const res = await fetch('/api/admin/backups');
            if (!res.ok) throw new Error('Failed to load backup data');
            const data = await res.json();
            setBackupData(data);
        } catch (e: any) {
            setBackupError(e.message || 'Failed to load backup data');
        } finally {
            setBackupLoading(false);
        }
    }, []);
    
    async function createBackup() {
        setBackupActionLoading(true);
        try {
            const res = await fetch('/api/admin/backups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create' }),
            });
            if (!res.ok) throw new Error('Failed to create backup');
            await loadBackups();
            alert('Backup created successfully!');
        } catch (e: any) {
            alert(e.message || 'Failed to create backup');
        } finally {
            setBackupActionLoading(false);
        }
    }
    
    // Audit log functions
    async function loadAuditLog(page = 1, action = '', search = '') {
        setAuditLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '50' });
            if (action) params.set('action', action);
            if (search) params.set('search', search);
            const res = await fetch(`/api/admin/audit-log?${params}`);
            if (!res.ok) throw new Error('Failed to load audit log');
            const data = await res.json();
            setAuditData(data);
            setAuditPage(page);
        } catch {
            // silently fail — table will be empty
        } finally {
            setAuditLoading(false);
        }
    }

    // Filter users by search
    const filteredUsers = users.filter(user => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            user.email?.toLowerCase().includes(query) ||
            user.name?.toLowerCase().includes(query) ||
            user.username?.toLowerCase().includes(query)
        );
    });
    
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
                                            <span className="text-accent">{users.filter(u => u.isActive).length}</span>
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
                                        <p className="text-2xl font-black text-white">{users.filter(u => !u.isActive).length}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Inactive</p>
                                    </div>
                                </div>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <div className="flex items-center gap-3">
                                    <Crown size={20} className="text-yellow-500" />
                                    <div>
                                        <p className="text-2xl font-black text-white">{users.filter(u => u.isSuperuser).length}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Admins</p>
                                    </div>
                                </div>
                            </div>
                            <div className="glass-card p-5 border-white/5 bg-white/5">
                                <div className="flex items-center gap-3">
                                    <Key size={20} className="text-primary" />
                                    <div>
                                        <p className="text-2xl font-black text-white">{users.filter(u => u.totpEnabled).length}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">2FA Enabled</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Search */}
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search users by name, email, or username..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
                            />
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
                                <h2 className="text-lg font-black text-white uppercase tracking-tight">User Registry</h2>
                                <span className="text-xs text-gray-500">{filteredUsers.length} users</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.02]">
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
                                            <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-all">
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
                                                        <Calendar size={10} /> {new Date(user.createdAt).toLocaleDateString()}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Clock size={10} /> {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
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
                                                            onClick={() => setDeleteConfirm(user.id)}
                                                            disabled={updating === user.id}
                                                            className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-all disabled:opacity-50"
                                                            title="Delete user"
                                                        >
                                                            {updating === user.id ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={14} />
                                                            )}
                                                        </button>
                                                    </div>
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
                                                <span className="text-sm font-bold text-white">{(infraData.errors.errorRate24h * 100).toFixed(2)}%</span>
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
                                                    {backupData.status.lastBackup ? formatRelative(backupData.status.lastBackup) : 'Never'}
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
            </div>
        </DashboardShell>
    );
}
