import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';

type AuthedHandler = (
  req: NextRequest,
  ctx: Record<string, unknown>,
  session: Session & { user: { id: string } }
) => Promise<Response>;

export function withAuth(handler: AuthedHandler) {
  return async (req: NextRequest, ctx: Record<string, unknown>): Promise<Response> => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, ctx, session as Session & { user: { id: string } });
  };
}
