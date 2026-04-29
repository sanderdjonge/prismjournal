import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    // Security note (6.1): 'unsafe-inline' is REQUIRED in script-src for Next.js
    // hydration. Removing it causes a black screen on page load because the browser
    // blocks the inline <script> chunks that Next.js injects for React hydration.
    // This was confirmed by testing — see commit 3c67017 which restored it after
    // a breakage. The risk is mitigated by: (a) no user-generated content in inline
    // scripts, (b) all API routes have withAuth/withAdmin + CSRF Origin checks,
    // (c) X-Frame-Options: DENY prevents clickjacking framing.
    //
    // Security note (6.5): connect-src 'self' restricts browser-side fetch to same
    // origin. All external API calls (Twelve Data, Nebul AI, Resend) go through
    // server-side API routes, so this is safe. Update if client-side external
    // fetches are ever needed.
    const csp = process.env.NODE_ENV === 'development'
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
      : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';";
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
