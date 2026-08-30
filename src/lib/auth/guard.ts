import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

/**
 * Guard for admin pages and admin server actions.
 *
 * `middleware.ts` already blocks unauthenticated requests to /admin/*, but every
 * mutation calls this too — middleware protects navigation, this protects the
 * action itself (defence in depth, section 37).
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect('/admin/login');
  return session.user;
}

/** Same check for route handlers, which return a response rather than redirecting. */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user?.id);
}
