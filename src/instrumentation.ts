/**
 * Next.js instrumentation — runs once on server startup.
 * Periodic scheduling is handled externally (external cron hits /api/cron/daily-snapshot).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { runDailySnapshot } = await import('@/lib/cron/snapshot');
    // Run once on startup after 30 seconds
    setTimeout(() => runDailySnapshot(), 30_000);
    // Periodic scheduling is handled externally (external cron hits /api/cron/daily-snapshot)
}
