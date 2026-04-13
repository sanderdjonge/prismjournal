import prisma from '@/lib/prisma';
import { validateFileUpload, timeframeEnum } from '@/lib/validations';
import { saveFile, generateFilename } from '@/lib/storage';
import { withAuth } from '@/lib/api/withAuth';
import { ok, badRequest, notFound } from '@/lib/api/responses';

export const POST = withAuth(async (req, ctx, session) => {
    const { id: tradeId } = await (ctx as { params: Promise<{ id: string }> }).params;

    const trade = await prisma.trade.findFirst({
        where: {
            id: tradeId,
            account: { userId: session.user.id }
        },
    });

    if (!trade) {
        return notFound('Trade');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const timeframeInput = formData.get('timeframe') as string | null;

    const fileValidation = validateFileUpload(file);
    if (!fileValidation.success) {
        return badRequest(fileValidation.error);
    }

    const validatedFile = file!;

    const timeframeResult = timeframeEnum.safeParse(timeframeInput || 'UNKNOWN');
    const timeframe = timeframeResult.success ? timeframeResult.data : 'UNKNOWN';

    const filename = generateFilename(validatedFile.name);
    const filepath = `screenshots/${filename}`;

    const buffer = Buffer.from(await validatedFile.arrayBuffer());
    await saveFile(buffer, filename);

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

    return ok({
        id: media.id,
        url: `/api/media/${media.id}/file`
    });
});

export const runtime = 'nodejs';
