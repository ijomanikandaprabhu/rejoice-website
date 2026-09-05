import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { SESSION_MAX_AGE_SECONDS } from '@/config/app.config';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { IDENTIFIER_IS_USER_ID, loginSchema } from '@/lib/validation';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

/**
 * Single-administrator authentication (section 8).
 *
 * There is exactly one account type and no registration flow anywhere in the app;
 * the only way an Admin row is created is the seed script or the Settings page.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: '/admin/login', error: '/admin/login' },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { identifier: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { identifier } = parsed.data;

        /*
         * Digits mean a User ID, anything else an email address. The same test
         * lives in `loginSchema`, which is why it is exported rather than
         * written twice — two copies would disagree and the disagreement would
         * look like a wrong password.
         */
        const admin = IDENTIFIER_IS_USER_ID.test(identifier)
          ? await prisma.admin.findUnique({ where: { userId: Number(identifier) } })
          : await prisma.admin.findUnique({ where: { email: identifier.toLowerCase() } });

        // Compare against a dummy hash when the account is missing so that an
        // unknown email, an unknown User ID and a wrong password all take the
        // same amount of time.
        const hash = admin?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
        const ok = await verifyPassword(parsed.data.password, hash);
        if (!admin || !ok) return null;

        await prisma.admin.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        });

        return { id: admin.id, email: admin.email, name: admin.name ?? 'Administrator' };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
