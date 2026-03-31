import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

const discordShareSchema = z.object({
    cardId: z.string(),
    webhookUrl: z.string().url(),
    message: z.string().max(500).optional(),
});

// Validate Discord webhook URL format
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
    try {
        const body = await request.json();
        const validated = discordShareSchema.parse(body);

        // Validate webhook URL is a Discord webhook
        if (!isValidDiscordWebhook(validated.webhookUrl)) {
            return NextResponse.json(
                { error: 'Invalid Discord webhook URL' },
                { status: 400 }
            );
        }

        // Get share card and verify ownership
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
            return NextResponse.json({ error: 'Share card not found' }, { status: 404 });
        }

        if (shareCard.userId !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Check expiration
        if (shareCard.expiresAt < new Date()) {
            return NextResponse.json({ error: 'Share card has expired' }, { status: 410 });
        }

        // Build Discord embed
        const isProfit = (shareCard.trade.pnl ?? 0) >= 0;
        const embed = {
            title: `${shareCard.trade.symbol} ${shareCard.trade.direction}`,
            description: validated.message || undefined,
            color: isProfit ? 0x4ade80 : 0xf87171, // Green for profit, red for loss
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

        // Build the Discord payload
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

        // Add image if media exists
        if (shareCard.media) {
            // Build the public URL for the image
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3002';
            discordEmbed.image = {
                url: `${baseUrl}/api/share/card/${shareCard.id}/image`,
            };
        }

        const discordPayload = {
            embeds: [discordEmbed],
        };

        // Send to Discord
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
            return NextResponse.json(
                { error: 'Failed to send to Discord' },
                { status: 502 }
            );
        }

        logger.info({ cardId: shareCard.id, userId: session.user.id }, '[share-discord] Shared successfully');

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request', details: error.errors },
                { status: 400 }
            );
        }

        logger.error({ error }, '[share-discord] Error');
        return NextResponse.json(
            { error: 'Failed to share to Discord' },
            { status: 500 }
        );
    }
});