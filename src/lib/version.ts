// Build-time version — reads from package.json via Node's module resolution.
// This file is only imported in server components or as a static constant;
// it is NOT a client bundle (no 'use client' needed here).
const pkg = require('../../package.json') as { version: string };

export const APP_VERSION = pkg.version; // e.g. "2.17.0"

/**
 * Build date — update this whenever you bump the version.
 * Format: YYYY-MM-DD
 */
export const BUILD_DATE = '2026-04-09';

export const BUILD_NOTES = 'Exit Quality Analysis & ExcursionBar now include trades with missing MAE (treats NULL MAE as 0 for profitable trades); fixes ~44% of trades missing efficiency scores';

/** Maps version to a human-readable phase label, e.g. "2.17.0" → "Phase 17" */
export function versionToPhase(version: string): string {
    const parts = version.split('.');
    const phase = parseInt(parts[1] ?? '0', 10);
    return `Phase ${phase}`;
}
