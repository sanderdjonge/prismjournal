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
    Tag,
    Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/cn';
import NotificationCenter from './NotificationCenter';
import AccountSwitcher from './AccountSwitcher';

const MENU_ITEMS = [
    { label: 'Dashboard', href: '/' },
    { label: 'Performance', href: '/performance' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Trading Accounts', href: '/pages/accounts' },
    { label: 'Journal', href: '/journal' },
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

    useEffect(() => {
        // Check if user is admin
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
            <nav className="fixed top-0 left-0 right-0 z-50 glass-card bg-black/60 border-b border-white/5 backdrop-blur-xl h-20 px-4 md:px-8 flex items-center justify-between">
                {/* Brand & Main Links */}
                <div className="flex items-center gap-4 md:gap-10">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00f2ff] to-[#7000ff] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                            <span className="font-black text-black text-[10px]">P</span>
                        </div>
                        <span className="font-black tracking-tighter text-lg md:text-xl neon-text group-hover:brightness-125 transition-all uppercase">
                            PRISM<span className="text-white/20">JOURNAL</span>
                        </span>
                    </Link>

                    {/* Desktop Menu - Hidden on mobile */}
                    <div className="hidden xl:flex items-center gap-1">
                        {MENU_ITEMS.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-2",
                                        isActive
                                            ? "bg-white/5 text-primary border border-primary/20 shadow-[0_0_10px_rgba(0,242,255,0.1)]"
                                            : "text-gray-500 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {item.icon && <item.icon size={12} />}
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Right Side Tools */}
                <div className="flex items-center gap-4 md:gap-6">
                    {/* Account Switcher */}
                    <AccountSwitcher />

                    {/* Notification Center */}
                    <NotificationCenter />

                    {/* Profile */}
                    <div className="flex items-center gap-2 md:gap-3 pl-4 md:pl-6 border-l border-white/5 relative">
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-sm font-bold text-white tracking-tight">{session?.user?.name ?? 'User'}</span>
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{session?.user?.email ?? ''}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 overflow-hidden group hover:border-primary transition-all"
                        >
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center">
                                <User size={18} className="text-gray-400 group-hover:text-primary" />
                            </div>
                        </button>
                        <ChevronDown size={14} className="text-gray-600 hidden md:block" />

                        {isProfileOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 glass-card bg-black/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden z-50">
                                {isAdmin && (
                                    <Link
                                        href="/admin"
                                        onClick={() => setIsProfileOpen(false)}
                                        className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-yellow-500 hover:text-yellow-400 hover:bg-white/5 flex items-center gap-2 transition-all"
                                    >
                                        <Shield size={14} /> Admin Portal
                                    </Link>
                                )}
                                <div className="border-t border-white/5" />
                                {USER_MENU_ITEMS.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsProfileOpen(false)}
                                        className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-all"
                                    >
                                        <item.icon size={14} /> {item.label}
                                    </Link>
                                ))}
                                <div className="border-t border-white/5" />
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-loss hover:text-loss/80 hover:bg-white/5 flex items-center gap-2 transition-all"
                                >
                                    <LogOut size={14} /> Sign Out
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="xl:hidden w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm xl:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <div 
                        className="fixed top-20 left-0 right-0 glass-card bg-black/90 border-b border-white/10 p-4 space-y-2"
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
                                            ? "bg-white/5 text-primary border border-primary/20"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
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
