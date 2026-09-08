'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { createLogger } from '@/lib/logger';

/**
 * Tell the server that a page failed for this visitor.
 *
 * Used by the three error boundaries. Before this, a boundary logged to the
 * browser console — which nobody is watching — and the owner found out about a
 * broken page when somebody mentioned it.
 *
 * `keepalive` is the important flag. Someone whose page just broke very often
 * closes the tab or hits back, and a normal `fetch` is cancelled when they do,
 * losing the one report that mattered. `keepalive` lets the browser finish it
 * after the page is gone.
 *
 * Everything here is best-effort by design: a site that is already broken must
 * not throw a second error while complaining about the first.
 */
export function useFaultReport(scope: string, error: Error & { digest?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const log = createLogger(scope);
    log.error('Unhandled error on a page', error);

    try {
      void fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          scope,
          path: pathname,
          digest: error.digest,
          message: error.message,
        }),
      }).catch(() => {
        // Reporting failed. There is nowhere left to report that to.
      });
    } catch {
      // Same.
    }
  }, [scope, error, pathname]);
}
