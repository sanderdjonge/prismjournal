import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/lib/auth';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

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
