import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { ok, badRequest, notFound, forbidden, internalError } from '@/lib/api/responses';

const discordShareSchema = z.object({
    cardId: z.string(),
    webhookUrl: z.string().url(),
    message: z.string().max(500).optional(),
});

function isValidDiscordWebhook(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            parsed.hostname === 'discord.com' &&
            parsed.pathname.startsWith('/api/webhooks/')
        );
    } catch {
        return false;
    }
}

export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const validation = await validateBody(request, discordShareSchema);
    if (!validation.success) return validation.response;
    const validated = validation.data;

    if (!isValidDiscordWebhook(validated.webhookUrl)) {
        return badRequest('Invalid Discord webhook URL');
    }

    try {
        const shareCard = await prisma.shareCard.findUnique({
            where: { id: validated.cardId },
            include: {
                media: true,
                trade: {
                    select: {
                        symbol: true,
                        direction: true,
                        pnl: true,
                    },
                },
            },
        });

        if (!shareCard) {
            return notFound('Share card');
        }

        if (shareCard.userId !== session.user.id) {
            return forbidden();
        }

        if (shareCard.expiresAt < new Date()) {
            return badRequest('Share card has expired');
        }

        const isProfit = (shareCard.trade.pnl ?? 0) >= 0;
        const embed = {
            title: `${shareCard.trade.symbol} ${shareCard.trade.direction}`,
            description: validated.message || undefined,
            color: isProfit ? 0x4ade80 : 0xf87171,
            fields: [
                {
                    name: 'P&L',
                    value: `${isProfit ? '+' : ''}$${Math.abs(shareCard.trade.pnl ?? 0).toFixed(2)}`,
                    inline: true,
                },
            ],
            footer: {
                text: 'Shared via PrismJournal',
            },
            timestamp: new Date().toISOString(),
        };

        interface DiscordEmbed {
            title: string;
            description?: string;
            color: number;
            fields: { name: string; value: string; inline: boolean }[];
            footer: { text: string };
            timestamp: string;
            image?: { url: string };
        }

        const discordEmbed: DiscordEmbed = { ...embed };

        if (shareCard.media) {
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3002';
            discordEmbed.image = {
                url: `${baseUrl}/api/share/card/${shareCard.id}/image`,
            };
        }

        const discordPayload = {
            embeds: [discordEmbed],
        };

        const response = await fetch(validated.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(discordPayload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error({ status: response.status, error: errorText }, '[share-discord] Webhook failed');
            return badRequest('Failed to send to Discord');
        }

        logger.info({ cardId: shareCard.id, userId: session.user.id }, '[share-discord] Shared successfully');

        return ok({ success: true });
    } catch (error) {
        logger.error({ error }, '[share-discord] Error');
        return internalError();
    }
});
