'use client';

import * as React from 'react';

/**
 * Asks the server whether a sync has been missed, once per browser session.
 *
 * Renders nothing. It exists because Vercel's scheduler has not been firing the
 * nightly cron on this project — see the route it calls for the evidence — and
 * an administrator opening the admin is the one moment the site can reliably
 * notice and put itself right.
 *
 * THE SERVER DECIDES, NOT THIS. All this does is knock; the route checks how
 * long it has been since the last successful sync and almost always answers
 * "fresh, nothing to do". Putting the threshold here would mean a browser could
 * ask for a full catalogue walk on every page load.
 *
 * ONCE PER SESSION, kept in `sessionStorage`. Without it every navigation
 * within the admin would knock again, and while the answer is cheap it is still
 * a round trip per page. A new tab or a fresh sign-in tries again, which is
 * what makes it recover after a browser restart.
 *
 * Deliberately silent. It reports nothing and shows nothing: when it does work,
 * the numbers on the page it just loaded are already a moment stale, and a
 * toast saying "synced" over a dashboard that has not re-rendered would be
 * worse than saying nothing. The Settings screen shows the sync time.
 */

const ONCE_KEY = 'rejoice.sync.catchup';

export function SyncCatchUp() {
  React.useEffect(() => {
    let asked = false;
    try {
      asked = sessionStorage.getItem(ONCE_KEY) === '1';
      sessionStorage.setItem(ONCE_KEY, '1');
    } catch {
      /*
       * Private browsing, or storage disabled. Knocking once per page load is
       * an acceptable cost; never knocking is not, and this net exists exactly
       * for the case where nothing else runs.
       */
    }
    if (asked) return;

    /*
     * `keepalive` so the request survives navigating away from the page that
     * started it. A catch-up can take tens of seconds, and an administrator who
     * lands on the dashboard and immediately clicks through to Songs would
     * otherwise cancel it every time — and it would never complete.
     */
    void fetch('/api/youtube/catch-up', { method: 'POST', keepalive: true }).catch(() => {
      // A failed knock is not worth telling anyone about; the cron and the
      // manual Sync Now both still exist.
    });
  }, []);

  return null;
}
