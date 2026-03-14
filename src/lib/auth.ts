import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import prisma from './prisma';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';

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

                if (!user?.password) return null;

                // Verify password
                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) return null;

                // Check if 2FA is enabled
                if (user.totpEnabled && user.totpSecret) {
                    const totpCode = credentials.totpCode as string;
                    
                    if (!totpCode) {
                        // Return special object to indicate 2FA is required
                        throw new Error('2FA_REQUIRED');
                    }

                    // Verify TOTP code using otplib v13 API
                    const result = verifySync({ secret: user.totpSecret, token: totpCode });
                    if (!result.valid) {
                        throw new Error('INVALID_2FA_CODE');
                    }
                }

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
