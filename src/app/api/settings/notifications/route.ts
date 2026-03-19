import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { sendTestEmail } from '@/lib/email';
import { validateBody, notificationSettingsSchema } from '@/lib/validations';
import { withAuth } from '@/lib/api/withAuth';

const DEFAULTS = {
    enableSync: true,
    enableTrades: true,
    enableRisk: true,
    telegramId: null as string | null,
    mddThreshold: null as number | null,
    // Email notification settings
    email: null as string | null,
    enableWeeklyDigest: false,
    enableMddAlerts: false,
};

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json(DEFAULTS);
    const userId = session.user.id;
    const config = await prisma.alertConfig.findUnique({ where: { userId } });
    return NextResponse.json(config ?? DEFAULTS);
}

export const PATCH = withAuth(async (req, _ctx, session) => {
    const userId = session.user.id;

    const validation = await validateBody(req, notificationSettingsSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;

    const config = await prisma.alertConfig.upsert({
        where: { userId },
        update: { ...body },
        create: { userId, ...DEFAULTS, ...body },
    });

    return NextResponse.json(config);
});

/**
 * POST /api/settings/notifications
 * Send a test email to the authenticated user's registered email address
 */
export const POST = withAuth(async (_req, _ctx, session) => {
    try {
        const email = session.user.email;
        if (!email) {
            return NextResponse.json({ success: false, error: 'No email address on account' }, { status: 400 });
        }

        const result = await sendTestEmail(email);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to send test email:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
});

export const runtime = 'nodejs';
