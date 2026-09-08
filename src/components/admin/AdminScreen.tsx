'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

import { RISE_PX, screenEnter } from '@/lib/motion';

/**
 * Every admin screen fades and lifts into place as it arrives.
 *
 * Mounted from `src/app/admin/template.tsx`, which Next re-renders on
 * navigation. ENTER ONLY — there is no `AnimatePresence` and no exit, which is
 * a correctness decision rather than a stylistic one: the App Router discards
 * the outgoing tree, so an exit both often fails to play AND, when it does,
 * leaves two screens in the DOM at once. `e2e/rejoice.spec.ts` clicks Edit into
 * a video and then asks for `getByLabel('Show on website')`; with the previous
 * screen still mounted that matches twice.
 *
 * KEYED ON `usePathname()`, not left to the template's own remount. Two reasons,
 * in opposite directions:
 *
 *   - The template's key is the first segment under /admin, so on its own it
 *     would NOT fire for /admin/songs -> /admin/songs/[id]. The key adds that.
 *   - `usePathname()` excludes the query string, so changing a filter —
 *     /admin/enquiries?status=READ — correctly does not re-animate. Sorting a
 *     table is not arriving at a screen.
 */
export function AdminScreen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  /*
   * `flex w-full flex-col gap-5` lives HERE, not on the `<main>` in the layout,
   * and moving it was not optional.
   *
   * `space-y-*` compiles to a DIRECT CHILD selector, which is why the layout
   * used flex `gap` in the first place: the Settings screen wraps several cards
   * in `<ActionForm className="contents">`, and `display: contents` removes the
   * form's box, taking those cards out of any direct-child selector's reach.
   * Flex `gap` fixes that by promoting them to items of the flex container — but
   * only of their grandparent. Introducing this wrapper inside `main` while
   * leaving the gap on `main` would have pushed them one level too deep and
   * brought the original bug straight back: three Settings cards flush against
   * the one above, `margin-top: 0px` where every sibling had 20px.
   */
  return (
    <motion.div
      key={pathname}
      /*
       * Framer writes `initial` into the server-rendered HTML, so this element
       * arrives at `opacity: 0` and is made visible by hydration. With
       * JavaScript off that never happens and the screen would stay invisible —
       * the `<noscript>` rule in the admin layout targets this attribute and
       * forces it back.
       */
      data-admin-screen=""
      /*
       * Reduced motion is handled by hand because it has to be. The global rule
       * at the end of globals.css only overrides CSS `animation-*` and
       * `transition-*`; Framer animates from JS and is untouched by it. Starting
       * opaque, with no transform, is also the safe failure — a screen must
       * never be able to rest invisible.
       */
      initial={reduce ? false : { opacity: 0, y: RISE_PX }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : screenEnter}
      className="flex w-full flex-col gap-5"
    >
      {children}
    </motion.div>
  );
}
