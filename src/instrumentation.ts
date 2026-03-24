/**
 * Next.js instrumentation — runs once on server startup.
 * Periodic scheduling is handled externally (external cron hits /api/cron/daily-snapshot).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { runDailySnapshot } = await import('@/lib/cron/snapshot');
    const { processScheduledScreenshots } = await import('@/lib/services/auto-screenshot.service');

    // Run once on startup after 30 seconds
    setTimeout(() => runDailySnapshot(), 30_000);

    // Process pending (delayed) screenshots every 2 minutes.
    // Runs in-process since the Docker container is a persistent Node.js server.
    setInterval(() => {
        processScheduledScreenshots().catch((err) => {
            // Import logger lazily to avoid circular deps at startup
            import('@/lib/logger').then(({ default: logger }) =>
                logger.error({ err }, '[instrumentation] processScheduledScreenshots failed')
            );
        });
    }, 2 * 60 * 1000);
}
