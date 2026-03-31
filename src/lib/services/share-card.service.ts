// src/lib/services/share-card.service.ts

import { chromium, Browser, Page } from 'playwright';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { saveFile, generateFilename, readFile } from '@/lib/storage';
import { generateShareCardHtml } from '@/lib/templates/share-card-template';
import { computePrismScore } from '@/lib/services/prism-score.service';
import type { TradeDirection } from '@prisma/client';

export interface ShareCardOptions {
  tradeId: string;
  userId: string;
  includeScreenshot: boolean;
  showPrismScore: boolean;
  platform: 'discord' | 'twitter' | 'reddit' | 'general';
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
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
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
  const { tradeId, userId, includeScreenshot, showPrismScore, platform } = options;

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

  // Get user settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      showPrismScoreOnShare: true,
    },
  });

  // Calculate Prism Score if needed
  let prismScore: number | undefined;
  let winRate: number | undefined;
  let profitFactor: number | undefined;

  if (showPrismScore && user?.showPrismScoreOnShare) {
    // Get user's closed trades for score calculation
    const userTrades = await prisma.trade.findMany({
      where: {
        account: { userId },
        exitTime: { not: null },
        pnl: { not: null },
      },
      select: { pnl: true, exitTime: true, entryTime: true },
    });

    const { score, components } = computePrismScore(userTrades);
    prismScore = Math.round(score);
    winRate = Math.round(components.winRate);
    profitFactor = components.profitFactor;
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
    showPrismScore: showPrismScore && (user?.showPrismScoreOnShare ?? false),
    prismScore,
    winRate,
    profitFactor,
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

    const pngBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    // Save to storage
    const filename = generateFilename('share-card.png');
    await saveFile(pngBuffer, filename);

    // Create media record
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

    // Create share card record
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const shareCard = await prisma.shareCard.create({
      data: {
        tradeId,
        userId,
        includeScreenshot,
        showPrismScore,
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
  const result = await prisma.shareCard.deleteMany({
    where: {
      expiresAt: { lte: new Date() },
    },
  });

  if (result.count > 0) {
    logger.info({ count: result.count }, '[share-card] Cleaned up expired cards');
  }
}