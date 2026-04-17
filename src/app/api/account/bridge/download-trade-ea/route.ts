import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { withAuth } from '@/lib/api/withAuth'

export const GET = withAuth(async () => {
    const filePath = join(process.cwd(), 'server', 'workers', 'PrismTrade.mq5')

    try {
        const content = await readFile(filePath)
        return new NextResponse(content, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="PrismTrade.mq5"',
            },
        })
    } catch {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
})

export const runtime = 'nodejs'
