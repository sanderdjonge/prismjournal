import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { spawn } from 'child_process';
import { withAdmin } from '@/lib/api/withAdmin';

/**
 * Run an external command without a shell (no string interpolation / injection risk).
 * Resolves with trimmed stdout on success, or '0' as a safe fallback on failure.
 */
function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 || stdout) resolve(stdout.trim());
      else resolve('0'); // fallback like the original || echo "0"
    });
    proc.on('error', reject);
  });
}


// Get database size
async function getDatabaseSize(): Promise<number> {
  try {
    const result = await prisma.$queryRaw<[{ size: bigint }]>`
      SELECT pg_database_size(current_database()) as size
    `;
    return Number(result[0].size) / (1024 * 1024); // Convert to MB
  } catch {
    return 0;
  }
}

// Get table row counts
async function getTableRowCounts(): Promise<Record<string, number>> {
  try {
    const [users, trades, media, accounts, strategies] = await Promise.all([
      prisma.user.count(),
      prisma.trade.count(),
      prisma.media.count(),
      prisma.tradingAccount.count(),
      prisma.strategy.count(),
    ]);
    
    return { users, trades, media, accounts, strategies };
  } catch {
    return { users: 0, trades: 0, media: 0, accounts: 0, strategies: 0 };
  }
}

// Get storage usage
async function getStorageUsage(): Promise<{ totalMb: number; screenshots: number; byType: Record<string, number> }> {
  try {
    // Get media counts by type
    const mediaByType = await prisma.media.groupBy({
      by: ['mimetype'],
      _count: true,
    });
    
    const byType: Record<string, number> = {};
    let screenshots = 0;
    
    for (const item of mediaByType) {
      byType[item.mimetype] = item._count;
      if (item.mimetype.startsWith('image/')) {
        screenshots += item._count;
      }
    }
    
    // Try to get actual storage size (works in Docker)
    // spawn() is used here so the path is passed as a plain argument with no
    // shell interpolation, eliminating any command-injection risk.
    let totalMb = 0;
    try {
      const storagePath = process.env.STORAGE_PATH || '/app/storage';
      const stdout = await runCommand('du', ['-sm', storagePath]);
      totalMb = parseFloat(stdout.split('\t')[0]) || 0;
    } catch {
      // Fallback: estimate based on average file size (500KB per file)
      const totalMedia = Object.values(byType).reduce((a, b) => a + b, 0);
      totalMb = totalMedia * 0.5; // 500KB per file estimate
    }
    
    return { totalMb, screenshots, byType };
  } catch {
    return { totalMb: 0, screenshots: 0, byType: {} };
  }
}

// Get user activity metrics
async function getUserActivity(): Promise<{
  activeSessions24h: number;
  loginsToday: number;
  failedLogins24h: number;
}> {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const [activeSessions24h, loginsToday, failedLogins24h] = await Promise.all([
      // Users who logged in within 24h
      prisma.user.count({
        where: { lastLoginAt: { gte: yesterday } },
      }),
      // Audit logs for successful logins today
      prisma.auditLog.count({
        where: {
          action: 'ADMIN_LOGIN',
          createdAt: { gte: todayStart },
        },
      }),
      // Note: We don't have a specific failed login action, so we'll return 0
      // This could be enhanced by adding a FAILED_LOGIN audit action
      Promise.resolve(0),
    ]);
    
    return { activeSessions24h, loginsToday, failedLogins24h };
  } catch {
    return { activeSessions24h: 0, loginsToday: 0, failedLogins24h: 0 };
  }
}

// Get error tracking
async function getErrorTracking(): Promise<{
  recentErrors: Array<{ action: string; details: unknown; createdAt: Date }>;
  failedSyncs24h: number;
  errorRate24h: number;
}> {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get recent security violations and errors
    const recentErrors = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: 'SECURITY_VIOLATION' },
          { action: { contains: 'ERROR' } },
        ],
        createdAt: { gte: yesterday },
      },
      select: {
        action: true,
        details: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    // Count failed syncs (we'd need to track this - for now return 0)
    const failedSyncs24h = 0;
    
    // Calculate error rate (errors / total requests in 24h)
    const totalActions24h = await prisma.auditLog.count({
      where: { createdAt: { gte: yesterday } },
    });
    
    const errorCount = recentErrors.length;
    const errorRate24h = totalActions24h > 0 ? errorCount / totalActions24h : 0;
    
    return { recentErrors, failedSyncs24h, errorRate24h };
  } catch {
    return { recentErrors: [], failedSyncs24h: 0, errorRate24h: 0 };
  }
}

// GET /api/admin/infrastructure
export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const startTime = Date.now();
    
    // Run all queries in parallel
    const [databaseSize, tableCounts, storageUsage, userActivity, errorTracking] = await Promise.all([
      getDatabaseSize(),
      getTableRowCounts(),
      getStorageUsage(),
      getUserActivity(),
      getErrorTracking(),
    ]);
    
    // Measure DB latency
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - dbStart;
    
    const apiLatencyMs = Date.now() - startTime;
    
    return NextResponse.json({
      database: {
        sizeMb: Math.round(databaseSize * 10) / 10,
        tables: tableCounts,
      },
      storage: {
        totalMb: Math.round(storageUsage.totalMb * 10) / 10,
        screenshots: storageUsage.screenshots,
        byType: storageUsage.byType,
      },
      health: {
        apiLatencyMs,
        dbLatencyMs,
        uptimeSeconds: process.uptime(),
        memoryUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        memoryTotalMb: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
      },
      activity: userActivity,
      errors: {
        recentErrors: errorTracking.recentErrors,
        failedSyncs24h: errorTracking.failedSyncs24h,
        errorRate24h: Math.round(errorTracking.errorRate24h * 1000) / 1000,
      },
    });
  } catch (error) {
    console.error('Infrastructure API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch infrastructure data' },
      { status: 500 }
    );
  }
});
