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

export const BUILD_NOTES = 'v2.40.0: Design system token consolidation — centralized CSS custom properties for all semantic colors/surfaces/borders/typography, Tailwind @theme mapping, composite component classes (glass-card, form-input, badge-*), chart-colors.ts utility, eliminated hardcoded hex and :root.light override hacks across 30+ components';

/** Maps version to a human-readable phase label, e.g. "2.17.0" → "Phase 17" */
export function versionToPhase(version: string): string {
    return `Phase ${parseInt(version.split('.')[1] ?? '0', 10)}`;
}
