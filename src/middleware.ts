import { auth } from '@/lib/auth';
import { authLimiter, loginLimiter, apiLimiter, syncLimiter } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname === '/login';
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
    if (rateLimitResponse) return rateLimitResponse;
  }

  // Rate limit login page (10 per minute)
  if (isLoginPage) {
    const rateLimitResponse = await loginLimiter.check(req, 10);
    if (rateLimitResponse) return rateLimitResponse;
  }

  // Rate limit sync endpoint (600 per minute — MT5 sends bursts on startup)
  if (isSyncApi) {
    const rateLimitResponse = await syncLimiter.check(req, 600);
    if (rateLimitResponse) return rateLimitResponse;
  }

  // General API rate limiting (skip webhooks, cron, health endpoints)
  if (nextUrl.pathname.startsWith('/api/') && !isTelegramWebhook && !isCronEndpoint && !isHealthEndpoint && !isRegisterEndpoint && !isSyncApi) {
    const rateLimitResponse = await apiLimiter.check(req, 100);
    if (rateLimitResponse) return rateLimitResponse;
  }

  // ====== AUTH ROUTING ======

  // Always allow auth API routes, MT5 sync, Telegram webhook, cron, and health endpoints
  if (isApiAuth || isSyncApi || isTelegramWebhook || isCronEndpoint || isHealthEndpoint) return;

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isLoginPage) {
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
