import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * PrismBridge Status Endpoint
 * Returns connectivity status and tunnel information for MT5 integration.
 */
export async function GET() {
    try {
        // 1. Attempt to discover Cloudflare Tunnel URL
        // This is a heuristic: checking for active tunnels via CLI if available
        const tunnelUrl = process.env.CLOUDFLARE_TUNNEL_URL || null;
        let isActive = false;

        try {
            // Check if cloudflared is running
            const { stdout } = await execAsync('ps aux | grep cloudflared | grep -v grep');
            if (stdout) isActive = true;
        } catch {
            isActive = false;
        }

        return NextResponse.json({
            status: 'online',
            bridge: {
                engine: 'PrismVector v1.0',
                isActive: isActive,
                tunnelUrl: tunnelUrl || 'https://prism-bridge.trycloudflare.com', // Placeholder/Fallback
                endpoint: '/api/sync',
                authType: 'X-API-Key'
            },
            system: {
                uptime: process.uptime(),
                node: process.version,
                timestamp: new Date().toISOString()
            }
        });

    } catch {
        return NextResponse.json({ error: 'Bridge Diagnostic Failure' }, { status: 500 });
    }
}
