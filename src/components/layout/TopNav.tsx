'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    User,
    ChevronDown,
    Calculator,
    HelpCircle,
    LogOut,
    Menu,
    X,
    Shield,
    Globe,
    Bell,
    Tag
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/cn';
import NotificationCenter from './NotificationCenter';
import AccountSwitcher from './AccountSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { APP_VERSION, BUILD_DATE } from '@/lib/version';

const MENU_ITEMS = [
    { label: 'Dashboard', href: '/' },
    { label: 'Performance', href: '/performance' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Journal', href: '/journal' },
    { label: 'Trading Accounts', href: '/pages/accounts' },
    { label: 'Strategies', href: '/pages/strategies' },
    { label: 'Calculator', href: '/calculator', icon: Calculator },
];

const USER_MENU_ITEMS = [
    { label: 'Preferences', href: '/settings?tab=preferences', icon: Globe },
    { label: 'Notifications', href: '/settings?tab=notifications', icon: Bell },
    { label: 'Tags', href: '/settings?tab=tags', icon: Tag },
    { label: 'Security', href: '/settings?tab=security', icon: Shield },
    { label: 'Help', href: '/pages/help', icon: HelpCircle },
];

export default function TopNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isProfileOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isProfileOpen]);

    useEffect(() => {
        if (session?.user?.id) {
            fetch('/api/settings')
                .then(r => r.json())
                .then(data => {
                    setIsAdmin(data.isSuperuser === true);
                })
                .catch(() => {});
        }
    }, [session]);

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--surface-solid)] border-b border-border-subtle h-20 px-4 md:px-8 flex items-center justify-between">
                <div className="flex items-center gap-4 md:gap-10">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shrink-0 shadow-[0_0_15px_var(--glow-primary)]">
                            <span className="font-black text-black text-[10px]">P</span>
                        </div>
                        <span className="font-black tracking-tighter text-lg md:text-xl neon-text group-hover:brightness-125 transition-all uppercase">
                                PRISM<span className="text-text-muted">JOURNAL</span>
                        </span>
                    </Link>

                    <div className="hidden lg:flex items-center gap-1">
                        {MENU_ITEMS.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-2",
                                        isActive
                                            ? "bg-surface-elevated text-primary border border-primary/20 shadow-[0_0_10px_var(--glow-primary)]"
                                            : "text-text-muted hover:text-text-primary hover:bg-surface-elevated"
                                    )}
                                >
                                    {item.icon && <item.icon size={12} />}
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-4 md:gap-6">
                    <AccountSwitcher />
                    <ThemeToggle />
                    <NotificationCenter />

                    <div className="flex items-center gap-2 md:gap-3 pl-4 md:pl-6 border-l border-border-subtle relative" ref={profileRef}>
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-sm font-bold text-text-primary tracking-tight">{session?.user?.name ?? 'User'}</span>
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">{session?.user?.email ?? ''}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 overflow-hidden group hover:border-primary transition-all"
                        >
                            <div className="w-full h-full rounded-full bg-surface-elevated flex items-center justify-center">
                                <User size={18} className="text-text-secondary group-hover:text-primary" />
                            </div>
                        </button>
                        <ChevronDown size={14} className="text-text-muted hidden md:block" />

                        {isProfileOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 border rounded-xl overflow-hidden z-50" style={{ backgroundColor: 'var(--surface-solid)', borderColor: 'var(--border-solid)' }}>
                                {isAdmin && (
                                    <Link
                                        href="/admin"
                                        onClick={() => setIsProfileOpen(false)}
                                        className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-warning hover:text-warning/80 hover:bg-surface-elevated flex items-center gap-2 transition-all"
                                    >
                                        <Shield size={14} /> Admin Portal
                                    </Link>
                                )}
                                <div className="border-t border-border-subtle" />
                                {USER_MENU_ITEMS.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsProfileOpen(false)}
                                        className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-surface-elevated flex items-center gap-2 transition-all"
                                    >
                                        <item.icon size={14} /> {item.label}
                                    </Link>
                                ))}
                                <div className="border-t border-border-subtle" />
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-loss hover:text-loss/80 hover:bg-surface-elevated flex items-center gap-2 transition-all"
                                >
                                    <LogOut size={14} /> Sign Out
                                </button>
                                <div className="border-t border-border-subtle px-4 py-3">
                                    <p className="text-[9px] font-mono text-text-muted">v{APP_VERSION} &middot; {BUILD_DATE}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="lg:hidden w-10 h-10 rounded-lg bg-surface-elevated border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <div
                        className="fixed top-20 left-0 right-0 bg-[var(--surface-solid)] border-b border-border-color p-4 space-y-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {MENU_ITEMS.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={cn(
                                        "block px-4 py-3 rounded-lg text-sm font-black uppercase tracking-[0.15em] transition-all duration-300 flex items-center gap-3",
                                        isActive
                                            ? "bg-surface-elevated text-primary border border-primary/20"
                                            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
                                    )}
                                >
                                    {item.icon && <item.icon size={16} />}
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
