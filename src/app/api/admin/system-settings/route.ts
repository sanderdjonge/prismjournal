import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withAdmin } from '@/lib/api/withAdmin';
import { ok, badRequest, internalError } from '@/lib/api/responses';
import type { AdminSession } from '@/lib/api/withAdmin';

export const GET = withAdmin(async () => {
    try {
        let settings = await prisma.systemSettings.findUnique({
            where: { id: 'system' },
        });
        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: { id: 'system', inviteOnlyMode: false },
            });
        }
        return ok({ inviteOnlyMode: settings.inviteOnlyMode });
    } catch (error) {
        console.error('Error fetching system settings:', error);
        return internalError();
    }
});

export const PATCH = withAdmin(async (req: NextRequest, _ctx: Record<string, unknown>, _session: AdminSession) => {
    try {
        const body = await req.json();
        const { inviteOnlyMode } = body;

        if (typeof inviteOnlyMode !== 'boolean') {
            return badRequest('inviteOnlyMode must be a boolean');
        }

        const settings = await prisma.systemSettings.upsert({
            where: { id: 'system' },
            update: { inviteOnlyMode, updatedAt: new Date() },
            create: { id: 'system', inviteOnlyMode },
        });

        return ok({ inviteOnlyMode: settings.inviteOnlyMode });
    } catch (error) {
        console.error('Error updating system settings:', error);
        return internalError();
    }
});
