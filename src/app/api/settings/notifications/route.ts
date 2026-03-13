import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDefaultAccount } from '@/lib/getAccount';
import { sendTestEmail } from '@/lib/email';
import { validateBody, notificationSettingsSchema, testEmailSchema } from '@/lib/validations';

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
    const account = await getDefaultAccount();
    if (!account) return NextResponse.json(DEFAULTS);
    const config = await prisma.alertConfig.findUnique({ where: { userId: account.userId } });
    return NextResponse.json(config ?? DEFAULTS);
}

export async function PATCH(request: Request) {
    const account = await getDefaultAccount();
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 500 });

    const validation = await validateBody(request, notificationSettingsSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;

    const config = await prisma.alertConfig.upsert({
        where: { userId: account.userId },
        update: { ...body },
        create: { userId: account.userId, ...DEFAULTS, ...body },
    });

    return NextResponse.json(config);
}

/**
 * POST /api/settings/notifications
 * Send a test email to verify email configuration
 */
export async function POST(request: Request) {
    try {
        const validation = await validateBody(request, testEmailSchema);
        if (!validation.success) {
            return validation.response;
        }

        const { email } = validation.data;
        const result = await sendTestEmail(email);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to send test email:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export const runtime = 'nodejs';
