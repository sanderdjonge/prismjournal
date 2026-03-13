import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateFileUpload, timeframeEnum } from '@/lib/validations';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const timeframeInput = formData.get('timeframe') as string | null;

    // Validate file
    const fileValidation = validateFileUpload(file);
    if (!fileValidation.success) {
        return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    // File is guaranteed to be non-null after validation
    // TypeScript still thinks it could be null, so we use non-null assertion
    const validatedFile = file!;

    // Validate timeframe
    const timeframeResult = timeframeEnum.safeParse(timeframeInput || 'UNKNOWN');
    const timeframe = timeframeResult.success ? timeframeResult.data : 'UNKNOWN';

    const buffer = Buffer.from(await validatedFile.arrayBuffer());
    const base64 = buffer.toString('base64');
    const url = `data:${validatedFile.type};base64,${base64}`;

    // Upsert — replace existing screenshot for same trade+timeframe
    const existing = await prisma.media.findFirst({
        where: { tradeId: id, timeframe },
    });

    if (existing) {
        await prisma.media.update({
            where: { id: existing.id },
            data: { url },
        });
    } else {
        await prisma.media.create({
            data: {
                tradeId: id,
                url,
                type: 'MANUAL',
                timeframe,
                event: 'OPEN',
            },
        });
    }

    return NextResponse.json({ url });
}

export const runtime = 'nodejs';
