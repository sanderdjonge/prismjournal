'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface User {
    id: string;
    email: string | null;
    name: string | null;
    username: string | null;
    isActive: boolean;
    isSuperuser: boolean;
    totpEnabled: boolean;
    createdAt: string;
    _count: {
        accounts: number;
        strategies: number;
    };
}

export default function AdminPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        try {
            const res = await fetch('/api/admin/users');
            if (res.status === 403) {
                setError('Access denied. Admin privileges required.');
                return;
            }
            if (!res.ok) throw new Error('Failed to load users');
            const data = await res.json();
            setUsers(data.users || []);
        } catch (e: any) {
            setError(e.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }

    async function updateUser(userId: string, updates: { isSuperuser?: boolean; isActive?: boolean }) {
        setUpdating(userId);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...updates }),
            });
            if (!res.ok) throw new Error('Failed to update user');
            const data = await res.json();
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u));
        } catch (e) {
            console.error('Failed to update user:', e);
        } finally {
            setUpdating(null);
        }
    }

    if (loading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 size={32} className="text-primary animate-spin" />
                </div>
            </DashboardShell>
        );
    }

    if (error) {
        return (
            <DashboardShell>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <AlertTriangle size={48} className="text-danger" />
                    <p className="text-danger text-sm font-bold">{error}</p>
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
            <div className="space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
                        <Shield size={28} className="text-danger" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Admin Portal</h1>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">User Management & System Administration</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-card p-5 border-white/5 bg-white/5">
                        <div className="flex items-center gap-3">
                            <Users size={20} className="text-primary" />
                            <div>
                                <p className="text-2xl font-black text-white">{users.length}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Users</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-5 border-white/5 bg-white/5">
                        <div className="flex items-center gap-3">
                            <UserCheck size={20} className="text-accent" />
                            <div>
                                <p className="text-2xl font-black text-white">{users.filter(u => u.isActive).length}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Active</p>
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

                {/* Users Table */}
                <div className="glass-card border-white/5 bg-black/40 overflow-hidden">
                    <div className="p-5 border-b border-white/5">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight">User Registry</h2>
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
                                    <th className="text-right p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
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
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Calendar size={10} /> {new Date(user.createdAt).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => updateUser(user.id, { isSuperuser: !user.isSuperuser })}
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
                                                    onClick={() => updateUser(user.id, { isActive: !user.isActive })}
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
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
