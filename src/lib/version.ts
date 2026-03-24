// Build-time version — reads from package.json via Node's module resolution.
// This file is only imported in server components or as a static constant;
// it is NOT a client bundle (no 'use client' needed here).
const pkg = require('../../package.json') as { version: string };

export const APP_VERSION = pkg.version; // e.g. "2.17.0"

/**
 * Build date — update this whenever you bump the version.
 * Format: YYYY-MM-DD
 */
export const BUILD_DATE = '2026-03-24';

/**
 * Short summary of what changed in this build.
 * Update together with APP_VERSION and BUILD_DATE.
 */
export const BUILD_NOTES = 'Close reason: MT5 EA v3.14 sends SL/TP/EA/STOP_OUT/MANUAL close reason; stored in DB, shown as coloured badge in journal table and trade view modal';

/** Maps version to a human-readable phase label, e.g. "2.17.0" → "Phase 17" */
export function versionToPhase(version: string): string {
    const parts = version.split('.');
    const phase = parseInt(parts[1] ?? '0', 10);
    return `Phase ${phase}`;
}
