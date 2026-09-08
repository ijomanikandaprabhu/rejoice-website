import 'server-only';

import { createLogger } from '@/lib/logger';

const log = createLogger('after-response');

/**
 * Run slow, non-essential work AFTER the response has gone to the visitor.
 *
 * The contact form is why this exists. It used to hold the response open for
 * the whole email send — 3.7-3.8s measured on the live site — because a
 * serverless function can be frozen the moment it responds, so a promise left
 * running has no guarantee of finishing. The platform's answer to that is
 * `waitUntil`: it keeps the function alive until the promise settles.
 *
 * ## Why this reads a symbol instead of importing `@vercel/functions`
 *
 * That package exists and does exactly this — but its `waitUntil` is a SILENT
 * NO-OP when it cannot find the request context. On a form, that failure mode
 * is the worst one available: the page gets faster and the emails quietly stop,
 * with nothing anywhere saying so.
 *
 * `@vercel/functions` finds the context by reading
 * `globalThis[Symbol.for('@vercel/request-context')]`. Reading it here directly
 * costs a dependency less and, far more importantly, lets us SEE whether it is
 * there and fall back to awaiting when it is not. Detection is the whole point;
 * the package cannot offer it.
 *
 * It is an undocumented platform detail, so treat it as one: everything is
 * guarded, and if the symbol ever disappears this returns `false` and the
 * caller awaits instead. The failure mode is "as slow as it used to be", never
 * "silently broken".
 *
 * Returns `true` when the work was handed to the platform, `false` when the
 * caller must await it itself.
 */
export function runAfterResponse(work: () => Promise<unknown>): boolean {
  const waitUntil = platformWaitUntil();
  if (!waitUntil) return false;

  try {
    /*
     * Errors are swallowed here as well as by the caller. A rejection with
     * nothing attached to it is an unhandled rejection, which on some runtimes
     * takes the whole function down — and this runs after the response, so it
     * would fail invisibly.
     */
    waitUntil(
      work().catch((error) => {
        log.error('Deferred work failed after the response was sent', error);
      }),
    );
    return true;
  } catch (error) {
    // The context existed but would not take the work. Let the caller await.
    log.warn('waitUntil refused the work; falling back to awaiting it', error);
    return false;
  }
}

type WaitUntil = (promise: Promise<unknown>) => void;

function platformWaitUntil(): WaitUntil | null {
  try {
    const holder = (globalThis as Record<symbol, unknown>)[
      Symbol.for('@vercel/request-context')
    ] as { get?: () => { waitUntil?: unknown } | undefined } | undefined;

    const waitUntil = holder?.get?.()?.waitUntil;
    return typeof waitUntil === 'function' ? (waitUntil as WaitUntil) : null;
  } catch {
    return null;
  }
}
