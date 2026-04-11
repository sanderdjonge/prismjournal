// Build-time version — reads from package.json via Node's module resolution.
// This file is only imported in server components or as a static constant;
// it is NOT a client bundle (no 'use client' needed here).
const pkg = require('../../package.json') as { version: string };

export const APP_VERSION = pkg.version; // e.g. "2.17.0"

/**
 * Build date — update this whenever you bump the version.
 * Format: YYYY-MM-DD
 */
export const BUILD_DATE = '2026-04-11';

export const BUILD_NOTES = 'v2.39.1: Security fixes — non-expiring invite tokens, admin rate limiting, admin page guard, migration fail-closed, economic events admin-only, error message normalization, impact enum validation, audit logging restored';

/** Maps version to a human-readable phase label, e.g. "2.17.0" → "Phase 17" */
export function versionToPhase(version: string): string {
    return `Phase ${parseInt(version.split('.')[1] ?? '0', 10)}`;
}
