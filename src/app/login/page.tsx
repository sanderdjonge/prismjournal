'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import { APP_VERSION, BUILD_DATE } from '@/lib/version';

type Tab = 'signin' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteOnlyMode, setInviteOnlyMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite) {
      setInviteToken(invite);
      setTab('register');
    }
    fetch('/api/auth/registration-mode')
      .then(r => r.json())
      .then(data => setInviteOnlyMode(data.inviteOnlyMode ?? false))
      .catch(() => {});
  }, [searchParams]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setError('');
    setShow2FA(false);
    setTotpCode('');
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    resetForm();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        ...(totpCode ? { totpCode } : {}),
        redirect: false,
      });

      if (!res?.error) {
        router.push('/');
        return;
      }

      const code = (res as any).code;
      if (code === '2FA_REQUIRED') {
        setShow2FA(true);
        setError('');
      } else if (code === 'INVALID_2FA_CODE') {
        setError('Invalid authenticator code. Please try again.');
        setTotpCode('');
      } else {
        setError('Invalid email or password.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (inviteOnlyMode && !inviteToken.trim()) {
      setError('Invite token is required for registration.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, invite: inviteToken || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.details && Array.isArray(data.details) && data.details.length > 0) {
          setError(data.details.map((d: { message: string }) => d.message).join('. '));
        } else {
          setError(data.error || 'Registration failed. Please try again.');
        }
        return;
      }

      const signInRes = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        setError('Account created but sign-in failed. Please sign in manually.');
        switchTab('signin');
      } else {
        router.push('/');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-surface-input border border-border-color rounded-xl p-4 text-sm font-bold text-text-primary outline-none focus:border-primary/50 transition-all placeholder:text-text-placeholder';

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-gray-950 to-surface flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-text-primary tracking-tighter uppercase italic">
            Prism
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mt-2">
            Trading Journal
          </p>
        </div>

        {/* Card */}
        <div className="glass-card backdrop-blur-md border border-border-subtle rounded-2xl p-8">
          {/* Tab toggle */}
          <div className="flex bg-surface-elevated rounded-xl p-1 mb-8">
            <button
              type="button"
              onClick={() => switchTab('signin')}
              className={cn(
                'flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                tab === 'signin'
                  ? 'bg-primary text-black shadow-[0_0_15px_var(--glow-primary)]'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={cn(
                'flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                tab === 'register'
                  ? 'bg-primary text-black shadow-[0_0_15px_var(--glow-primary)]'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              Register
            </button>
          </div>

          {/* Sign In Form */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  autoComplete="current-password"
                />
              </div>

              {!show2FA && (
                <div className="text-right">
                  <a
                    href="/forgot-password"
                    className="text-text-secondary text-xs hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
              )}

              {show2FA && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                    Authenticator Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className={inputClass}
                    autoFocus
                  />
                  <p className="text-[10px] text-text-muted mt-2">
                    Enter the 6-digit code from your authenticator app.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-danger text-xs font-semibold">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full px-8 py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 shadow-[0_0_20px_var(--glow-primary)] hover:brightness-110 active:scale-95 transition-all',
                  loading && 'opacity-70 cursor-not-allowed'
                )}
              >
                {loading ? 'Authenticating...' : show2FA ? 'Verify Code' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  autoComplete="new-password"
                />
                <p className="text-[9px] text-text-muted mt-1.5">Min 8 chars, with uppercase, lowercase & number</p>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                  Invite Token{' '}
                  {inviteOnlyMode
                    ? <span className="text-danger">*required</span>
                    : <span className="text-text-muted">(optional)</span>
                  }
                </label>
                <input
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder={inviteOnlyMode ? 'Enter your invite token' : 'Enter invite token if you have one'}
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="text-danger text-xs font-semibold">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full px-8 py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 shadow-[0_0_20px_var(--glow-primary)] hover:brightness-110 active:scale-95 transition-all',
                  loading && 'opacity-70 cursor-not-allowed'
                )}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-1">
          <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest">
            PrismJournal &copy; {new Date().getFullYear()}
          </p>
          <p className="text-text-muted text-[9px] font-mono">
            v{APP_VERSION} &middot; {BUILD_DATE}
          </p>
        </div>
      </div>
    </div>
  );
}
