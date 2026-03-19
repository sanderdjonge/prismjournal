import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { validateBody, settingsUpdateSchema } from '@/lib/validations';

export async function GET() {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json({ displayCurrency: 'USD', timezone: 'Europe/Amsterdam', twoFAEnabled: false, isSuperuser: false });
    }

    const [settings, user] = await Promise.all([
        prisma.userSettings.findUnique({ where: { userId } }),
        prisma.user.findUnique({ where: { id: userId }, select: { totpEnabled: true, isSuperuser: true } }),
    ]);

    return NextResponse.json({
        displayCurrency: settings?.displayCurrency ?? 'USD',
        timezone: settings?.timezone ?? 'Europe/Amsterdam',
        twoFAEnabled: user?.totpEnabled ?? false,
        isSuperuser: user?.isSuperuser ?? false,
    });
}

export async function PATCH(request: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await validateBody(request, settingsUpdateSchema);
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
        },
    });
    return NextResponse.json(settings);
}

export const runtime = 'nodejs';
