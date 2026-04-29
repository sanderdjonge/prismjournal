import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import prisma from './prisma';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import { logAuditEvent } from './audit';

class TwoFactorRequiredError extends CredentialsSignin {
    code = '2FA_REQUIRED';
}
class InvalidTwoFactorCodeError extends CredentialsSignin {
    code = 'INVALID_2FA_CODE';
}

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

// TOTP setup: pending secrets stored in memory until verified (max 10 minutes)
export const pendingTotpSecrets = new Map<string, { secret: string; expiresAt: number }>();

export function cleanupPendingSecrets(): void {
    const now = Date.now();
    for (const [key, entry] of pendingTotpSecrets) {
        if (now > entry.expiresAt) {
            pendingTotpSecrets.delete(key);
        }
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                totpCode: { label: '2FA Code', type: 'text' },
            },
            async authorize(credentials) {
                // Security note (1.5): No per-account lockout — rate limiting is IP-based.
                // Distributed credential stuffing bypasses this. Accepted: single-user app
                // behind Cloudflare with bot protection.
                //
                // Security note (1.6): Password reset does not invalidate existing JWT
                // sessions — they expire naturally via maxAge. Accepted: short session
                // lifetime (7d) limits the exposure window.
                if (!credentials?.email || !credentials?.password) return null;
                // Security note (1.7): loginSchema exists but is not used here —
                // NextAuth credentials provider handles its own null checks.

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
                        throw new TwoFactorRequiredError();
                    }

                    // TOTP replay protection
                    cleanupUsedCodes();
                    const codeKey = `${user.id}:${totpCode}`;
                    if (usedTotpCodes.has(codeKey)) {
                        logAuditEvent('2FA_FAILED', user.id, { reason: 'replay' }).catch(console.error);
                        throw new InvalidTwoFactorCodeError();
                    }

                    // Verify TOTP code using otplib v13 API
                    const result = verifySync({ secret: user.totpSecret, token: totpCode });
                    if (!result.valid) {
                        logAuditEvent('2FA_FAILED', user.id, { reason: 'invalid_code' }).catch(console.error);
                        throw new InvalidTwoFactorCodeError();
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
