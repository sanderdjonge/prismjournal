import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateFileUpload, timeframeEnum } from '@/lib/validations';
import { saveFile, generateFilename } from '@/lib/storage';
import { withAuth } from '@/lib/api/withAuth';

export const POST = withAuth(async (req, ctx, session) => {
    const { id: tradeId } = await (ctx as { params: Promise<{ id: string }> }).params;

    // Verify user owns the trade
    const trade = await prisma.trade.findFirst({
        where: {
            id: tradeId,
            account: { userId: session.user.id }
        },
    });

    if (!trade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const timeframeInput = formData.get('timeframe') as string | null;

    // Validate file
    const fileValidation = validateFileUpload(file);
    if (!fileValidation.success) {
        return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    const validatedFile = file!;

    // Validate timeframe
    const timeframeResult = timeframeEnum.safeParse(timeframeInput || 'UNKNOWN');
    const timeframe = timeframeResult.success ? timeframeResult.data : 'UNKNOWN';

    // Generate unique filename
    const filename = generateFilename(validatedFile.name);
    const filepath = `screenshots/${filename}`;

    // Convert file to buffer and save
    const buffer = Buffer.from(await validatedFile.arrayBuffer());
    await saveFile(buffer, filename);

    // Create media record in database
    const media = await prisma.media.create({
        data: {
            tradeId,
            filename,
            filepath,
            mimetype: validatedFile.type,
            size: validatedFile.size,
            type: 'MANUAL',
            timeframe,
            event: 'OPEN',
        },
    });

    // Return the URL path for fetching the file
    return NextResponse.json({
        id: media.id,
        url: `/api/media/${media.id}/file`
    });
});

export const runtime = 'nodejs';
