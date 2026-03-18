'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (token) {
      setTokenValid(true);
    } else {
      setTokenValid(false);
    }
  }, [token]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. Please try again.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all placeholder:text-gray-600';

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
              Prism
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mt-2">
              Trading Journal
            </p>
          </div>

          <div className="glass-card bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-danger/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Invalid Link</h2>
            <p className="text-gray-400 text-sm mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <a
              href="/forgot-password"
              className="inline-block px-6 py-3 bg-primary text-black font-semibold text-sm rounded-xl hover:brightness-110 transition-all"
            >
              Request New Link
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
            Prism
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mt-2">
            Trading Journal
          </p>
        </div>

        {/* Card */}
        <div className="glass-card bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-8">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password Reset!</h2>
              <p className="text-gray-400 text-sm mb-6">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <a
                href="/login"
                className="inline-block px-6 py-3 bg-primary text-black font-semibold text-sm rounded-xl hover:brightness-110 transition-all"
              >
                Sign In
              </a>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-white mb-2">Reset Your Password</h2>
                <p className="text-gray-400 text-sm">
                  Enter a new password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
                    New Password
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
                  <p className="text-gray-500 text-[10px] mt-1">
                    Min 8 chars, 1 uppercase, 1 lowercase, 1 number
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <p className="text-danger text-xs font-semibold">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    'w-full px-8 py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:brightness-110 active:scale-95 transition-all',
                    loading && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-700 text-[10px] font-bold uppercase tracking-widest mt-8">
          PrismJournal &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
