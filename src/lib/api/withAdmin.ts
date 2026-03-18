import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type AdminHandler = (
    req: Request,
    session: { user: { id: string } }
) => Promise<NextResponse> | NextResponse;

export function withAdmin(handler: AdminHandler) {
    return async (req: Request): Promise<NextResponse> => {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isSuperuser: true },
        });

        if (!user?.isSuperuser) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        try {
            return await handler(req, { user: { id: session.user.id } });
        } catch (error) {
            console.error('[withAdmin]', req.url, error);
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    };
}
