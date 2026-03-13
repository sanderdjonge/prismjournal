import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
    const filePath = join(process.cwd(), 'server', 'workers', 'PrismSync.mq5');

    try {
        const content = await readFile(filePath);
        return new NextResponse(content, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="PrismSync.mq5"',
            },
        });
    } catch {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}

export const runtime = 'nodejs';
