// src/lib/services/share-card.service.ts

import { chromium, Browser, Page } from 'playwright';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { saveFile, generateFilename, readFile, deleteFile } from '@/lib/storage';
import { generateShareCardHtml } from '@/lib/templates/share-card-template';
import { computePrismScore } from '@/lib/services/prism-score.service';
import type { TradeDirection } from '@prisma/client';

export interface ShareCardOptions {
  tradeId: string;
  userId: string;
  includeScreenshot: boolean;
  showPrismScore: boolean;
  isPublic: boolean;
  platform: 'discord' | 'twitter' | 'reddit' | 'general';
  comment?: string;
}

export interface ShareCardResult {
  cardId: string;
  mediaId: string;
  imageUrl: string;
  expiresAt: Date;
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    // Use system Chromium in Docker (PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH env var)
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
    browserInstance = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
  }
  return browserInstance;
}

export async function closeShareCardBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function generateShareCard(options: ShareCardOptions): Promise<ShareCardResult> {
  const { tradeId, userId, includeScreenshot, showPrismScore, isPublic, platform, comment } = options;

  // Fetch trade data
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: {
      media: {
        where: { type: 'AUTO' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!trade) {
    throw new Error(`Trade not found: ${tradeId}`);
  }

  // Check ownership via account
  const account = await prisma.tradingAccount.findUnique({
    where: { id: trade.accountId },
    select: { userId: true },
  });
  if (!account || account.userId !== userId) {
    throw new Error('Unauthorized: Trade does not belong to user');
  }

  // User settings could be fetched here if needed for future features

  // Calculate Prism Score if needed
  // Note: showPrismScore comes from the toggle in ShareTradeModal
  // The user account setting showPrismScoreOnShare is separate (for future use)
  let prismScore: number | undefined;
  let winRate: number | undefined;
  let profitFactor: number | undefined;

  if (showPrismScore) {
    // Get user's closed trades for score calculation
    const userTrades = await prisma.trade.findMany({
      where: {
        account: { userId },
        exitTime: { not: null },
        pnl: { not: null },
      },
      select: { pnl: true, exitTime: true, entryTime: true },
    });

    const { score } = computePrismScore(userTrades);
    prismScore = Math.round(score);

    // Compute actual win rate % and profit factor from raw data
    const closedTrades = userTrades.filter(t => t.exitTime !== null && t.pnl !== null) as { pnl: number; exitTime: Date }[];
    const wins = closedTrades.filter(t => t.pnl > 0);
    const losses = closedTrades.filter(t => t.pnl < 0);
    winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = losses.reduce((s, t) => s + Math.abs(t.pnl), 0);
    profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : (grossProfit > 0 ? 10 : 1);
  }

  // Build screenshot URL if available
  let screenshotUrl: string | undefined;
  if (includeScreenshot && trade.media.length > 0) {
    const latestMedia = trade.media[0];
    // For Playwright, we need to load the image data and embed it
    try {
      const imageBuffer = await readFile(latestMedia.filename);
      const base64 = imageBuffer.toString('base64');
      screenshotUrl = `data:image/png;base64,${base64}`;
    } catch (err) {
      logger.warn({ err, filename: latestMedia.filename }, '[share-card] Could not load screenshot, will use placeholder');
    }
  }

  // Build template data
  const templateData = {
    trade: {
      symbol: trade.symbol,
      direction: trade.direction as TradeDirection,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      pnl: trade.pnl ?? 0,
      rrMultiple: trade.rMultiple,
      openedAt: trade.entryTime,
      closedAt: trade.exitTime,
    },
    screenshotUrl,
    showPrismScore,
    prismScore,
    winRate,
    profitFactor,
    comment: comment?.trim() || undefined,
  };

  // Generate HTML
  const html = generateShareCardHtml(templateData);

  // Render to PNG via Playwright
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setViewportSize({ width: 600, height: 350 });
    await page.setContent(html, { waitUntil: 'networkidle' });

    // Wait for any images to load
    if (screenshotUrl) {
      await page.waitForTimeout(500); // Brief wait for base64 image
    }

    // Screenshot the card element directly to avoid any sub-pixel viewport clipping
    const cardEl = await page.$('.card');
    const pngBuffer = cardEl
      ? await cardEl.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png', fullPage: false, clip: { x: 0, y: 0, width: 600, height: 350 } });

    // Save to storage
    const filename = generateFilename('share-card.png');
    await saveFile(pngBuffer, filename);

    // Check if a share card already exists for this trade + user
    const existingCard = await prisma.shareCard.findUnique({
      where: { tradeId_userId: { tradeId, userId } },
      include: { media: true },
    });

    // If exists and has old media, delete the old media file and record
    if (existingCard?.media) {
      try {
        await deleteFile(existingCard.media.filename);
      } catch {
        // Ignore if file doesn't exist
      }
      await prisma.media.delete({ where: { id: existingCard.media.id } });
    }

    // Create new media record
    const media = await prisma.media.create({
      data: {
        tradeId,
        filename,
        filepath: `screenshots/${filename}`,
        mimetype: 'image/png',
        size: pngBuffer.length,
        type: 'SHARE_CARD',
        event: 'CLOSE',
      },
    });

    // Upsert share card record (update if exists, create if not)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const shareCard = await prisma.shareCard.upsert({
      where: { tradeId_userId: { tradeId, userId } },
      update: {
        includeScreenshot,
        showPrismScore,
        isPublic,
        platform,
        mediaId: media.id,
        expiresAt,
      },
      create: {
        tradeId,
        userId,
        includeScreenshot,
        showPrismScore,
        isPublic,
        platform,
        mediaId: media.id,
        expiresAt,
      },
    });

    logger.info({ cardId: shareCard.id, tradeId, platform }, '[share-card] Generated');

    return {
      cardId: shareCard.id,
      mediaId: media.id,
      imageUrl: `/api/share/card/${shareCard.id}/image`,
      expiresAt,
    };
  } finally {
    await page.close();
  }
}

export async function getShareCardImage(cardId: string): Promise<Buffer | null> {
  const shareCard = await prisma.shareCard.findUnique({
    where: { id: cardId },
    include: {
      media: true,
    },
  });

  if (!shareCard || !shareCard.media) {
    return null;
  }

  // Check expiration
  if (shareCard.expiresAt < new Date()) {
    return null;
  }

  return readFile(shareCard.media.filename);
}

export async function cleanupExpiredCards(): Promise<void> {
  const expired = await prisma.shareCard.findMany({
    where: { expiresAt: { lte: new Date() } },
    include: { media: true },
  });

  if (expired.length === 0) return;

  // Delete physical files and Media DB records first, then ShareCard records
  for (const card of expired) {
    if (card.media) {
      try {
        await deleteFile(card.media.filename);
      } catch {
        // File may already be gone — not fatal
      }
      try {
        await prisma.media.delete({ where: { id: card.media.id } });
      } catch {
        // Media may have already been deleted — not fatal
      }
    }
  }

  const { count } = await prisma.shareCard.deleteMany({
    where: { id: { in: expired.map(c => c.id) } },
  });

  logger.info({ count }, '[share-card] Cleaned up expired cards');
}