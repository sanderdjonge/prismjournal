'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send reset email. Please try again.');
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
              <h2 className="text-xl font-bold text-white mb-2">Check Your Email</h2>
              <p className="text-gray-400 text-sm mb-6">
                If an account with that email exists, we've sent a password reset link.
              </p>
              <a
                href="/login"
                className="inline-block px-6 py-3 bg-white/10 rounded-xl text-white font-semibold text-sm hover:bg-white/20 transition-all"
              >
                Back to Sign In
              </a>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-white mb-2">Forgot Password?</h2>
                <p className="text-gray-400 text-sm">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
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
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <a
                  href="/login"
                  className="text-gray-400 text-sm hover:text-white transition-colors"
                >
                  ← Back to Sign In
                </a>
              </div>
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
