import { NextResponse } from 'next/server';

import { edgeAuth } from '@/lib/auth/edge';

/**
 * Route protection (sections 8, 37).
 *
 * Everything under /admin requires a session, except the login page itself.
 * Admin API routes are covered too; the public /api/contact and the YouTube
 * webhook/cron endpoints authenticate themselves by other means and are excluded
 * by the matcher below.
 */
export default edgeAuth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user);
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    if (isLoggedIn) return NextResponse.redirect(new URL('/admin', req.nextUrl));
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL('/admin/login', req.nextUrl);
    // Remember where they were headed so login can send them back.
    if (pathname !== '/admin') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*'],
};
