'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/cn';

interface TwoFactorSetupProps {
    isConfigured: boolean;
    onEnabled: () => void;
    onDisabled: () => void;
}

export default function TwoFactorSetup({ isConfigured, onEnabled, onDisabled }: TwoFactorSetupProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [setupData, setSetupData] = useState<{ secret: string; provisioning_uri: string } | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [verifyCode, setVerifyCode] = useState('');

    const [disableMode, setDisableMode] = useState(false);
    const [disablePassword, setDisablePassword] = useState('');
    const [disableCode, setDisableCode] = useState('');

    const handleInitiateSetup = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/2fa/setup', { method: 'POST' });
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Failed to setup 2FA');
            
            setSetupData(data);
            
            // Generate QR code
            const qrUrl = await QRCode.toDataURL(data.provisioning_uri);
            setQrCodeUrl(qrUrl);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: verifyCode }),
            });
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Failed to verify 2FA');
            
            setSetupData(null);
            setVerifyCode('');
            setSuccess('Two-Factor Authentication is now enabled!');
            setTimeout(() => setSuccess(''), 5000);
            onEnabled();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDisable2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/2fa/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: disablePassword, code: disableCode }),
            });
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Failed to disable 2FA');
            
            setDisableMode(false);
            setDisablePassword('');
            setDisableCode('');
            setSuccess('Two-Factor Authentication has been disabled.');
            setTimeout(() => setSuccess(''), 5000);
            onDisabled();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6 mt-6 max-w-4xl">
            {success && (
                <div className="mb-4 p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm">
                    {success}
                </div>
            )}
            {error && (
                <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
                    {error}
                </div>
            )}

            <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-black tracking-tight text-white">🛡️ Two-Factor Authentication</h3>
                <span className={cn(
                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full",
                    isConfigured 
                        ? "bg-accent/10 text-accent border border-accent/20" 
                        : "bg-danger/10 text-danger border border-danger/20"
                )}>
                    {isConfigured ? 'Enabled' : 'Disabled'}
                </span>
            </div>

            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Secure your account with TOTP Two-Factor Authentication. When enabled, you will be required to enter a 6-digit code from your authenticator app (like Authy or Google Authenticator) every time you log in.
            </p>

            {!isConfigured && !setupData && (
                <button
                    onClick={handleInitiateSetup}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-primary/20 text-primary border border-primary/30 text-xs font-black uppercase tracking-widest hover:bg-primary/30 transition-all duration-300 disabled:opacity-50"
                >
                    {loading ? 'Initiating...' : 'Enable 2FA'}
                </button>
            )}

            {!isConfigured && setupData && (
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 mt-4">
                    <h4 className="text-sm font-bold text-white mb-4">Setup Instructions</h4>
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-shrink-0">
                            {qrCodeUrl && (
                                <div className="bg-white p-3 rounded-xl inline-block">
                                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-36 h-36" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <ol className="text-sm text-gray-400 space-y-2 mb-6 list-decimal list-inside">
                                <li>Open your Authenticator app.</li>
                                <li>Scan the QR code shown here.</li>
                                <li>Enter the 6-digit code generated by the app below to verify.</li>
                            </ol>
                            <form onSubmit={handleVerifySetup} className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={verifyCode}
                                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                                        required
                                        autoFocus
                                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white font-mono text-lg tracking-[0.5em] text-center focus:outline-none focus:border-primary/50"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || verifyCode.length !== 6}
                                    className="px-6 py-3 rounded-xl bg-primary/20 text-primary border border-primary/30 text-xs font-black uppercase tracking-widest hover:bg-primary/30 transition-all duration-300 disabled:opacity-50"
                                >
                                    {loading ? 'Verifying...' : 'Verify & Enable'}
                                </button>
                            </form>
                            <p className="text-xs text-gray-600 mt-4">
                                If you cannot scan the QR code, manually enter this secret: <br />
                                <code className="font-mono text-primary select-all">{setupData.secret}</code>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {isConfigured && !disableMode && (
                <button
                    onClick={() => setDisableMode(true)}
                    className="px-6 py-3 rounded-xl bg-danger/10 text-danger border border-danger/20 text-xs font-black uppercase tracking-widest hover:bg-danger/20 transition-all duration-300"
                >
                    Disable 2FA
                </button>
            )}

            {isConfigured && disableMode && (
                <div className="bg-danger/5 border border-danger/20 rounded-xl p-6 mt-4">
                    <h4 className="text-sm font-bold text-danger mb-4">Disable Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-400 mb-6">
                        To disable 2FA, please enter your password and the current 6-digit code from your authenticator app.
                    </p>
                    <form onSubmit={handleDisable2FA} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    value={disablePassword}
                                    onChange={(e) => setDisablePassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-danger/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                                    6-Digit Code
                                </label>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={disableCode}
                                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                                    required
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white font-mono text-center tracking-widest focus:outline-none focus:border-danger/50"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={loading || !disablePassword || disableCode.length !== 6}
                                className="px-6 py-3 rounded-xl bg-danger/20 text-danger border border-danger/30 text-xs font-black uppercase tracking-widest hover:bg-danger/30 transition-all duration-300 disabled:opacity-50"
                            >
                                {loading ? 'Disabling...' : 'Confirm Disable'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setDisableMode(false);
                                    setDisablePassword('');
                                    setDisableCode('');
                                    setError('');
                                }}
                                className="px-6 py-3 rounded-xl bg-white/5 text-gray-400 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all duration-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
