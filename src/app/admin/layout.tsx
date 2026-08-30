import type { Metadata } from 'next';

import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminToaster } from '@/components/admin/AdminToaster';
import { logoutAction } from '@/features/auth/actions';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

/** Administration must never be indexed (section 32). */
export const metadata: Metadata = {
  title: 'Rejoice Admin',
  robots: { index: false, follow: false },
};

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

  return (
    <div className="admin-theme min-h-screen">
      <AdminTopBar email={admin?.email ?? session.user.email ?? ''} logout={logoutAction} />
      {/*
       * `flex flex-col gap-5`, not `space-y-5`.
       *
       * `space-y-*` compiles to `> :not([hidden]) ~ :not([hidden])` — a DIRECT
       * CHILD selector. The Settings screen wraps several cards in
       * `<ActionForm className="contents">` so one form can cover more than one
       * card, and `display: contents` removes the form's box, which takes those
       * cards out of that selector's reach. Measured: every card inside such a
       * form had `margin-top: 0px` while its siblings had 20px, so three cards
       * sat flush against the one above.
       *
       * Flex `gap` fixes it at the root: `display: contents` promotes those
       * grandchildren to flex items of this element, so they are spaced like any
       * other card. A margin utility cannot reach them at all.
       */}
      <main className="mx-auto flex w-full max-w-[86rem] flex-col gap-5 px-4 py-6 sm:px-6">
        {children}
      </main>
      <AdminToaster />
    </div>
  );
}
