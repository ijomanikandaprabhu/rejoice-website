'use client';

import { useEffect } from 'react';

/**
 * Stop a missed drop from navigating away and taking the form with it.
 *
 * ## The problem this exists for
 *
 * A browser's default answer to a file dropped on a page is to OPEN that file.
 * So the cost of missing `ImageUploadField`'s 240px square — dropping an inch
 * low, onto the Title field or the gap beside it — is not "nothing happens". It
 * is the admin screen replaced by a picture of a song cover, and every field
 * filled in up to that point gone. There is no warning and no way back except
 * the back button and typing it all again.
 *
 * That is the usual reason drag and drop is disliked, and it is entirely the
 * browser's doing rather than the page's.
 *
 * ## How it works
 *
 * `preventDefault` on `dragover` and `drop` at the window. Both are needed:
 * cancelling only `drop` still leaves `dragover` telling the browser the page
 * will not handle it, and the file opens anyway.
 *
 * The upload frame is unaffected. Its own handlers call `preventDefault` on the
 * way UP, long before the event reaches the window, so a drop that lands on the
 * square is still a drop that works. This only catches the ones that miss.
 *
 * `{ passive: false }` is not decoration: Chrome treats these as passive by
 * default on some surfaces, and a passive listener's `preventDefault` is
 * ignored with a console warning and no other sign.
 *
 * ## Why admin only
 *
 * The public site has no upload anywhere. Changing what a browser does with a
 * dropped file, for visitors who are not trying to upload anything, would be
 * taking away a browser behaviour to solve a problem that cannot occur there.
 *
 * Renders nothing.
 */
export function DropGuard() {
  useEffect(() => {
    const swallow = (event: Event) => event.preventDefault();

    window.addEventListener('dragover', swallow, { passive: false });
    window.addEventListener('drop', swallow, { passive: false });

    return () => {
      window.removeEventListener('dragover', swallow);
      window.removeEventListener('drop', swallow);
    };
  }, []);

  return null;
}
