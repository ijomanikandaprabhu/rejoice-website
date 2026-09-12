import type { Metadata } from 'next';

import { AdminLoader } from '@/components/admin/AdminLoader';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminToaster } from '@/components/admin/AdminToaster';
import { DropGuard } from '@/components/admin/DropGuard';
import { SyncCatchUp } from '@/components/admin/SyncCatchUp';
import { logoutAction } from '@/features/auth/actions';
import { markAllReadAction } from '@/features/notifications/actions';
import { listNotifications, unreadCount } from '@/features/notifications/queries';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

/** Administration must never be indexed (section 32). */
export const metadata: Metadata = {
  title: 'Rejoice Admin',
  robots: { index: false, follow: false },
};

/*
 * The overlay plus the escape hatch that guarantees it can be dismissed, kept
 * together so the two returns below cannot drift apart.
 *
 * `dangerouslySetInnerHTML`, not a nested JSX `<style>` child: the public
 * layout's comment records that the JSX form threw React error #423 and took
 * the page down. Without this rule the `holding` state in the served HTML would
 * leave a visitor with JavaScript off facing a panel they can never close.
 */
function AdminOpeningScreen() {
  return (
    <>
      <AdminLoader />
      <noscript
        dangerouslySetInnerHTML={{
          __html:
            '<style>[data-admin-loader]{display:none!important}' +
            '[data-admin-screen]{opacity:1!important;transform:none!important}</style>',
        }}
      />
    </>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  /*
   * `admin-theme` opts this subtree into the panel palette and Manrope. The
   * public site owns `body`; without this class the two systems would fight
   * over the same tokens.
   */

  // The login page renders inside this layout too, before a session exists.
  if (!session?.user) {
    return (
      <div className="admin-theme min-h-screen">
        <AdminOpeningScreen />
        {children}
        <AdminToaster />
      </div>
    );
  }

  /*
   * The email comes from the database, not from `session.user.email`.
   *
   * Sessions are JWTs, so changing the address in Settings left the token — and
   * therefore this bar — showing the old one for the rest of the 8-hour session.
   * One lookup by primary key is worth having the screen tell the truth.
   */
  const admin = await prisma.admin.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  /*
   * The bell's contents, read here because the top bar is a client component.
   * Only the preview is fetched — the full history lives on its own page — so
   * this stays a small query on a path every admin screen takes.
   */
  const [unread, items] = await Promise.all([unreadCount(), listNotifications(6)]);

  return (
    <div className="admin-theme min-h-screen">
      <AdminOpeningScreen />
      <AdminTopBar
        email={admin?.email ?? session.user.email ?? ''}
        logout={logoutAction}
        notifications={{ unread, items }}
        markAllRead={markAllReadAction}
      />
      {/*
       * The flex column that spaces these cards lives on `AdminScreen`, one
       * level down, NOT here — see the long note in that component. It is load
       * bearing: the Settings screen relies on being a direct child of whatever
       * carries the `gap`, and this element is no longer that.
       */}
      <main className="mx-auto w-full max-w-[86rem] px-4 py-6 sm:px-6">{children}</main>
      <AdminToaster />
      {/*
       * In the LAYOUT rather than on the dashboard, so it fires whichever admin
       * screen is opened first — the catch-up is worth as much to someone who
       * goes straight to YouTube Content as to someone who lands on the
       * dashboard. Renders nothing; see the component.
       */}
      <SyncCatchUp />
      {/*
       * Here rather than on the two screens that hold an upload: a file dropped
       * an inch below the cover square lands on the layout, not on the form, so
       * the thing that has to catch it is the thing wrapping everything.
       *
       * Not in the signed-out branch above. The login page has nothing to
       * upload, and a guard there would be taking a browser behaviour away to
       * prevent something that cannot happen. Renders nothing; see the
       * component for why the browser's default is worth stopping at all.
       */}
      <DropGuard />
    </div>
  );
}
