// Build-time version — reads from package.json via Node's module resolution.
// This file is only imported in server components or as a static constant;
// it is NOT a client bundle (no 'use client' needed here).
const pkg = require('../../package.json') as { version: string };

export const APP_VERSION = pkg.version; // e.g. "2.17.0"

/**
 * Build date — update this whenever you bump the version.
 * Format: YYYY-MM-DD
 */
export const BUILD_DATE = '2026-04-13';

export const BUILD_NOTES = 'v2.43.0: Code Consolidation Phase 2D-2F — Replaced 50+ raw fetch() calls in 11 client components with apiFetch/hooks; added Zod validateBody to 17 API routes; standardized 273 NextResponse.json() → response helpers in 46 API routes; replaced 43 console.error → pino logger in 28 files';

/** Maps version to a human-readable phase label, e.g. "2.17.0" → "Phase 17" */
export function versionToPhase(version: string): string {
    return `Phase ${parseInt(version.split('.')[1] ?? '0', 10)}`;
}
