import { NextRequest, NextResponse } from 'next/server';
import { runDailySnapshot } from '@/lib/cron/snapshot';
import { verifyCronSecret } from '@/lib/api/verifyCronSecret';
import { uploadBackupToS3 } from '@/lib/backup-s3';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

async function handleCronRequest(request: NextRequest) {
    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

    await runDailySnapshot();

    if (process.env.S3_BUCKET) {
      try {
        const backupPath = process.env.BACKUP_PATH || '/app/backups';
        const date = new Date().toISOString().split('T')[0];
        const key = `backups/cron-snapshots/snapshot-${date}.json`;

        const metrics = await prisma.systemMetric.findFirst({
          orderBy: { timestamp: 'desc' },
        });

        const snapshotData = JSON.stringify({
          date,
          timestamp: new Date().toISOString(),
          metrics,
        });

        const { writeFile, mkdir } = await import('fs/promises');
        const localPath = `${backupPath}/snapshot-${date}.json`;
        await mkdir(backupPath, { recursive: true });
        await writeFile(localPath, snapshotData);

        await uploadBackupToS3(localPath, key);
        logger.info({ key }, '[daily-snapshot] S3 upload complete');
      } catch (error) {
        logger.error({ err: error }, '[daily-snapshot] S3 upload failed');
      }
    }

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
    return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
    return handleCronRequest(request);
}

export const runtime = 'nodejs';
