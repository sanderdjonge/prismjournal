import { auth } from '@/lib/auth';
import { authLimiter, loginLimiter, apiLimiter, syncLimiter } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const LOGIN_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_LOGIN ?? '10');
const API_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_API ?? '100');
const SYNC_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_SYNC ?? '600');

function warnAuditEvent(action: string, meta: Record<string, unknown>): void {
  console.warn(JSON.stringify({ audit: true, action, ...meta, ts: Date.now() }));
}

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname === '/login';
  const isForgotPasswordPage = nextUrl.pathname === '/forgot-password';
  const isResetPasswordPage = nextUrl.pathname === '/reset-password';
  const isApiAuth = nextUrl.pathname.startsWith('/api/auth');
  const isSyncApi = nextUrl.pathname === '/api/sync';
  const isTelegramWebhook = nextUrl.pathname === '/api/telegram/webhook';
  const isCronEndpoint = nextUrl.pathname.startsWith('/api/cron');
  const isHealthEndpoint = nextUrl.pathname === '/api/health';
  const isRegisterEndpoint = nextUrl.pathname === '/api/auth/register';

  // ====== RATE LIMITING ======

  // Rate limit registration endpoint (very strict: 5 per minute)
  if (isRegisterEndpoint) {
    const rateLimitResponse = await authLimiter.check(req, 5);
    if (rateLimitResponse) {
      warnAuditEvent('RATE_LIMIT_HIT', { endpoint: '/api/auth/register', ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown' });
      return rateLimitResponse;
    }
  }

  // Rate limit sign-in POST only — configurable via RATE_LIMIT_LOGIN env var (default: 10/min)
  // We check /api/auth/signin (the NextAuth POST endpoint) rather than the /login page load,
  // so legitimate page renders don't count against the limit.
  const isSignInPost = nextUrl.pathname === '/api/auth/signin' && req.method === 'POST';
  if (isSignInPost) {
    const rateLimitResponse = await loginLimiter.check(req, LOGIN_RATE_LIMIT);
    if (rateLimitResponse) {
      warnAuditEvent('RATE_LIMIT_HIT', { endpoint: '/login', ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown' });
      return rateLimitResponse;
    }
  }

  // Rate limit sync endpoint — configurable via RATE_LIMIT_SYNC env var (default: 600/min, MT5 sends bursts on startup)
  if (isSyncApi) {
    const rateLimitResponse = await syncLimiter.check(req, SYNC_RATE_LIMIT);
    if (rateLimitResponse) {
      warnAuditEvent('RATE_LIMIT_HIT', { endpoint: '/api/sync', ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown' });
      return rateLimitResponse;
    }
  }

  // General API rate limiting — configurable via RATE_LIMIT_API env var (default: 100/min)
  // Skips webhooks, cron, and health endpoints
  if (nextUrl.pathname.startsWith('/api/') && !isTelegramWebhook && !isCronEndpoint && !isHealthEndpoint && !isRegisterEndpoint && !isSyncApi) {
    const rateLimitResponse = await apiLimiter.check(req, API_RATE_LIMIT);
    if (rateLimitResponse) {
      warnAuditEvent('RATE_LIMIT_HIT', { endpoint: nextUrl.pathname, ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown' });
      return rateLimitResponse;
    }
  }

  // ====== AUTH ROUTING ======

  // Always allow auth API routes, MT5 sync, Telegram webhook, cron, and health endpoints
  if (isApiAuth || isSyncApi || isTelegramWebhook || isCronEndpoint || isHealthEndpoint) return;

  // Allow unauthenticated access to password reset pages
  if (isForgotPasswordPage || isResetPasswordPage) return;

  // Redirect unauthenticated users to login
  // Only log SESSION_INVALID when a session cookie is present but auth is null (stale/expired session),
  // not for fresh unauthenticated visitors (crawlers, bots, first-time visitors).
  if (!isLoggedIn && !isLoginPage) {
    const hasSessionCookie =
      req.cookies.get('next-auth.session-token') ?? req.cookies.get('__Secure-next-auth.session-token');
    if (hasSessionCookie) {
      warnAuditEvent('SESSION_INVALID', { path: nextUrl.pathname, ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown' });
    }
    // API routes return 401 JSON so clients get a parseable error instead of an HTML redirect
    if (nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // Redirect authenticated users away from login
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
