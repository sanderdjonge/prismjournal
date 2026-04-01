import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';
import { checkLimit, Limiters } from '@/lib/rate-limit-redis';
import type { Session } from 'next-auth';

type AuthedHandler = (
  req: NextRequest,
  ctx: Record<string, unknown>,
  session: Session & { user: { id: string } }
) => Promise<Response>;

export function withAuth(handler: AuthedHandler) {
  return async (req: NextRequest, ctx: Record<string, unknown>): Promise<Response> => {
    const rateLimitResponse = await checkLimit(req, Limiters.api);
    if (rateLimitResponse) return rateLimitResponse;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      return await handler(req, ctx, session as Session & { user: { id: string } });
    } catch (error) {
      logger.error({ url: req.url, err: error }, '[withAuth] Unhandled error');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
