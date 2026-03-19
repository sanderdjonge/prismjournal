import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import prisma from './prisma';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import { logAuditEvent } from './audit';

// TOTP replay protection: track used codes for 90 seconds
export const usedTotpCodes = new Map<string, number>();

export function cleanupUsedCodes(): void {
    const now = Date.now();
    for (const [key, expiry] of usedTotpCodes) {
        if (now > expiry) {
            usedTotpCodes.delete(key);
        }
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: 'jwt' },
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                totpCode: { label: '2FA Code', type: 'text' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user?.password) {
                    logAuditEvent('LOGIN_FAILED', null, { email: credentials.email as string, reason: 'user_not_found' }).catch(console.error);
                    return null;
                }

                // Verify password
                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) {
                    logAuditEvent('LOGIN_FAILED', user.id, { email: user.email, reason: 'wrong_password' }).catch(console.error);
                    return null;
                }

                // Reject deactivated accounts
                if (!user.isActive) {
                    logAuditEvent('LOGIN_FAILED', user.id, { email: user.email, reason: 'deactivated' }).catch(console.error);
                    return null;
                }

                // Check if 2FA is enabled
                if (user.totpEnabled && user.totpSecret) {
                    const totpCode = credentials.totpCode as string;

                    if (!totpCode) {
                        // Return special object to indicate 2FA is required
                        throw new Error('2FA_REQUIRED');
                    }

                    // TOTP replay protection
                    cleanupUsedCodes();
                    const codeKey = `${user.id}:${totpCode}`;
                    if (usedTotpCodes.has(codeKey)) {
                        logAuditEvent('2FA_FAILED', user.id, { reason: 'replay' }).catch(console.error);
                        throw new Error('INVALID_2FA_CODE');
                    }

                    // Verify TOTP code using otplib v13 API
                    const result = verifySync({ secret: user.totpSecret, token: totpCode });
                    if (!result.valid) {
                        logAuditEvent('2FA_FAILED', user.id, { reason: 'invalid_code' }).catch(console.error);
                        throw new Error('INVALID_2FA_CODE');
                    }

                    // Mark code as used for 90 seconds
                    usedTotpCodes.set(codeKey, Date.now() + 90_000);
                }

                // Audit: successful login + update lastLoginAt
                logAuditEvent('LOGIN_SUCCESS', user.id, { email: user.email }).catch(console.error);
                prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(console.error);

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    totpEnabled: user.totpEnabled
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.totpEnabled = user.totpEnabled;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.totpEnabled = token.totpEnabled as boolean;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
});
