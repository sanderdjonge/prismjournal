/**
 * Database health and backup monitoring endpoint.
 * Protected by CRON_SECRET header.
 *
 * GET /api/health/db
 * Returns DB row counts and backup status.
 * Returns 503 if DB is unreachable or last backup is stale (>2h).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readdir, stat } from 'fs/promises';
import path from 'path';

interface BackupInfo {
    lastBackupAt: string | null;
    ageMinutes: number | null;
    hourlyCount: number;
    dailyCount: number;
    weeklyCount: number;
    stale: boolean;
    error?: string;
}

async function getBackupInfo(): Promise<BackupInfo> {
    const base = path.join(process.cwd(), 'backups');
    try {
        const [hourlyFiles, dailyFiles, weeklyFiles] = await Promise.all([
            readdir(path.join(base, 'hourly')).catch(() => [] as string[]),
            readdir(path.join(base, 'daily')).catch(() => [] as string[]),
            readdir(path.join(base, 'weekly')).catch(() => [] as string[]),
        ]);

        const hourlyDumps = hourlyFiles.filter(f => f.endsWith('.dump')).sort().reverse();
        const dailyCount = dailyFiles.filter(f => f.endsWith('.dump')).length;
        const weeklyCount = weeklyFiles.filter(f => f.endsWith('.dump')).length;

        if (hourlyDumps.length === 0) {
            return { lastBackupAt: null, ageMinutes: null, hourlyCount: 0, dailyCount, weeklyCount, stale: true };
        }

        const latestPath = path.join(base, 'hourly', hourlyDumps[0]);
        const fileStat = await stat(latestPath);
        const ageMinutes = Math.round((Date.now() - fileStat.mtime.getTime()) / 60_000);

        return {
            lastBackupAt: fileStat.mtime.toISOString(),
            ageMinutes,
            hourlyCount: hourlyDumps.length,
            dailyCount,
            weeklyCount,
            stale: ageMinutes > 120,
        };
    } catch (err) {
        return {
            lastBackupAt: null,
            ageMinutes: null,
            hourlyCount: 0,
            dailyCount: 0,
            weeklyCount: 0,
            stale: true,
            error: 'Backup directory not accessible (not mounted?)',
        };
    }
}

export async function GET(request: NextRequest) {
    const secret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!secret || !expectedSecret || secret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let dbHealthy = true;
    let dbError: string | undefined;
    const counts: Record<string, number> = {};

    try {
        const [users, trades, accounts, tags] = await Promise.all([
            prisma.user.count(),
            prisma.trade.count(),
            prisma.tradingAccount.count(),
            prisma.tag.count(),
        ]);
        counts.users = users;
        counts.trades = trades;
        counts.tradingAccounts = accounts;
        counts.tags = tags;
    } catch (err) {
        dbHealthy = false;
        dbError = err instanceof Error ? err.message : 'Unknown error';
    }

    const backup = await getBackupInfo();

    const status = !dbHealthy
        ? 'db_error'
        : backup.stale
            ? 'backup_stale'
            : 'healthy';

    const httpStatus = dbHealthy ? 200 : 503;

    return NextResponse.json(
        {
            status,
            db: { healthy: dbHealthy, counts, error: dbError },
            backup,
            timestamp: new Date().toISOString(),
        },
        { status: httpStatus }
    );
}
