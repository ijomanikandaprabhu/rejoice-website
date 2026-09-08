'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Says what just happened, when the action that did it ended in a redirect.
 *
 * Adding or editing a song finishes with `redirect('/admin/songs')`, and a
 * redirect leaves nothing to return — the action throws, so its `ActionState`
 * never reaches the form. The result was that pressing "Save song" moved you to
 * the list and said nothing at all, which reads far more like the button threw
 * you out than like a save. It was reported as "edit and save not working"; the
 * save had in fact worked every time.
 *
 * So the message travels in the address instead, and this reads it on arrival.
 */

/**
 * A fixed list, and it has to be.
 *
 * The value comes out of the address bar, so anyone can type one. Looking the
 * key up here means the worst a stranger can do is show one of these four
 * sentences, rather than choose the words the admin appears to say.
 */
const MESSAGES: Record<string, string> = {
  'song-added': 'Song added.',
  'song-updated': 'Song saved.',
};

export function SavedToast({ saved }: { saved?: string }) {
  /*
   * Fires once for a given value. Without the guard, React's development
   * double-render shows the toast twice — and the parameter is stripped below,
   * so the second one would be the only lasting impression.
   */
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!saved || shown.current === saved) return;

    const message = MESSAGES[saved];
    if (!message) return;

    shown.current = saved;
    toast.success(message);

    /*
     * Then take it out of the address.
     *
     * `replaceState`, not a router navigation: this must not add a history
     * entry (Back would land on the same page again) and must not re-run the
     * server render. Leaving it in place would re-announce "Song saved" on
     * every refresh, and would put it in any link the operator copied.
     */
    const url = new URL(window.location.href);
    url.searchParams.delete('saved');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [saved]);

  return null;
}
