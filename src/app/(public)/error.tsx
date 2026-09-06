'use client';

import { useEffect } from 'react';

import { createLogger } from '@/lib/logger';

const log = createLogger('public-error');

/**
 * Error boundary for the public site.
 *
 * Without one, anything a server component throws — the database being
 * unreachable is the realistic case — reaches Next's default error screen:
 * unbranded, no navigation, no way back. This catches it and offers a retry.
 *
 * The message is deliberately not rendered. `error.message` can carry internals
 * (connection strings, upstream response bodies), so it goes to the log and the
 * visitor gets a plain sentence. `digest` is Next's own id for the server-side
 * error and is safe to show — it is what lets a report be matched to a log line.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error('Unhandled error on a public page', error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="t-label">Something went wrong</p>
      <h1 className="t-h1 mt-5">This page could not be loaded</h1>
      <p className="mt-4 max-w-md text-body leading-[1.7] text-site-muted">
        The problem is on our side, not yours. Try again. If it keeps happening, please get in
        touch and we will look into it.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/" className="btn-secondary">
          Back to home
        </a>
      </div>

      {error.digest ? (
        <p className="mt-8 text-sm text-site-muted/60">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
