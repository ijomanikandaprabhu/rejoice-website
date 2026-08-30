'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin-error');

/**
 * Error boundary for the admin portal.
 *
 * Same reasoning as the public one, with the admin's own palette. The raw
 * message is logged rather than rendered — Prisma errors in particular embed
 * connection details — and only Next's `digest` is shown, so a report can be
 * matched to a log line.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error('Unhandled error in the admin portal', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10">
        <AlertTriangle aria-hidden="true" className="size-6 text-destructive" />
      </span>

      <h1 className="mt-5 text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        This screen could not be loaded. If the database has just restarted, retrying usually
        resolves it.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="/admin">Back to dashboard</a>
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
