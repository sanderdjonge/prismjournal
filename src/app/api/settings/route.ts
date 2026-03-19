import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// eslint-disable-next-line no-restricted-imports
import { auth } from '@/lib/auth';
import { validateBody, settingsUpdateSchema } from '@/lib/validations';
import { withAuth } from '@/lib/api/withAuth';

export async function GET() {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json({ displayCurrency: 'USD', timezone: 'Europe/Amsterdam', dateFormat: 'DD-MM-YYYY', twoFAEnabled: false, isSuperuser: false });
    }

    const [settings, user] = await Promise.all([
        prisma.userSettings.findUnique({ where: { userId } }),
        prisma.user.findUnique({ where: { id: userId }, select: { totpEnabled: true, isSuperuser: true } }),
    ]);

    return NextResponse.json({
        displayCurrency: settings?.displayCurrency ?? 'USD',
        timezone: settings?.timezone ?? 'Europe/Amsterdam',
        dateFormat: settings?.dateFormat ?? 'DD-MM-YYYY',
        twoFAEnabled: user?.totpEnabled ?? false,
        isSuperuser: user?.isSuperuser ?? false,
    });
}

export const PATCH = withAuth(async (req, _ctx, session) => {
    const validation = await validateBody(req, settingsUpdateSchema);
    if (!validation.success) {
        return validation.response;
    }

    const body = validation.data;
    const userId = session.user.id;

    const settings = await prisma.userSettings.upsert({
        where: { userId },
        update: { ...body },
        create: {
            userId,
            displayCurrency: body.displayCurrency ?? 'USD',
            timezone: body.timezone ?? 'Europe/Amsterdam',
            dateFormat: body.dateFormat ?? 'DD-MM-YYYY',
        },
    });
    return NextResponse.json(settings);
});

export const runtime = 'nodejs';
