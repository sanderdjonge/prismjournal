/**
 * Next.js instrumentation — runs once on server startup.
 * Schedules the daily-snapshot cron to run every hour automatically.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    const { runDailySnapshot } = await import('@/lib/cron/snapshot');

    // Run once on startup (catches any missed snapshots)
    setTimeout(() => runDailySnapshot(), 30_000);

    // Then every hour
    setInterval(() => runDailySnapshot(), 60 * 60 * 1000);
}
