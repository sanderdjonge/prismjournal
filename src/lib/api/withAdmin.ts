import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';
import type { Session } from 'next-auth';

export type AdminSession = Session & { user: { id: string; isSuperuser: boolean } };

type AdminHandler = (
  req: NextRequest,
  ctx: Record<string, unknown>,
  session: AdminSession
) => Promise<Response>;

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function withAdmin(handler: AdminHandler) {
  return async (req: NextRequest, ctx: Record<string, unknown>): Promise<Response> => {
    const rateLimitResponse = await checkLimit(req, Limiters.admin);
    if (rateLimitResponse) return rateLimitResponse;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSRF: verify Origin header on state-mutating requests
    if (MUTATING_METHODS.has(req.method)) {
      const origin = req.headers.get('origin');
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            logger.warn({ origin, host, url: req.url }, '[withAdmin] CSRF origin mismatch');
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSuperuser: true },
    });

    if (user?.isSuperuser !== true) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminSession = {
      ...session,
      user: { ...session.user, isSuperuser: true },
    } as AdminSession;

    try {
      return await handler(req, ctx, adminSession);
    } catch (error) {
      logger.error({ url: req.url, err: error }, '[withAdmin] Unhandled error');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
