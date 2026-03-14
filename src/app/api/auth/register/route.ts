import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validateBody, registerSchema } from '@/lib/validations';

export async function POST(request: Request) {
    try {
        const validation = await validateBody(request, registerSchema);
        if (!validation.success) {
            return validation.response;
        }

        const body = validation.data;

        const existing = await prisma.user.findUnique({ where: { email: body.email } });
        if (existing) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(body.password, 12);

        const user = await prisma.user.create({
            data: {
                email: body.email,
                password: hashedPassword,
                name: body.name ?? body.email.split('@')[0],
            },
        });

        // Create a default trading account for the new user
        // Use user ID in account number to ensure uniqueness
        await prisma.tradingAccount.create({
            data: {
                userId: user.id,
                name: 'Default Account',
                broker: 'Manual',
                accountNumber: `MANUAL-${user.id.slice(-8).toUpperCase()}`,
                currency: 'USD',
                leverage: 100,
                bridgeKey: `prism_${randomBytes(24).toString('hex')}`,
            },
        });

        return NextResponse.json({ id: user.id, email: user.email, name: user.name });
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export const runtime = 'nodejs';
