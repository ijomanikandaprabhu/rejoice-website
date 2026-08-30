import NextAuth from 'next-auth';

import { SESSION_MAX_AGE_SECONDS } from '@/config/app.config';

/**
 * Edge-safe auth instance used only by middleware.
 *
 * Middleware runs on the Edge runtime, which cannot load Prisma or bcrypt. This
 * instance declares no providers — it only needs to read and verify the session
 * cookie. The real credentials provider lives in `@/lib/auth`.
 */
export const { auth: edgeAuth } = NextAuth({
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  providers: [],
  trustHost: true,
  pages: { signIn: '/admin/login' },
});
