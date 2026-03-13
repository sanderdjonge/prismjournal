import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
    interface User extends DefaultUser {
        id: string;
        totpEnabled?: boolean;
    }
    
    interface Session extends DefaultSession {
        user: User & {
            id: string;
            totpEnabled?: boolean;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT extends DefaultJWT {
        id: string;
        totpEnabled?: boolean;
    }
}
