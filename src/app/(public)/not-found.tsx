import Link from 'next/link';

/**
 * 404 for the public site.
 *
 * The root `src/app/not-found.tsx` sits outside this route group, so a
 * `notFound()` from a video or channel page rendered with no header and no
 * footer — a dead end with no way back. This one lives inside `(public)`, so it
 * keeps the site's navigation.
 */
export default function PublicNotFound() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="t-label">Error 404</p>
      <h1 className="t-h1 mt-5">This page does not exist</h1>
      <p className="mt-4 max-w-md text-body leading-[1.7] text-site-muted">
        The page you asked for is not here. It may have moved, or the link may be old.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          Back to home
        </Link>
        <Link href="/creations" className="btn-secondary">
          Browse releases
        </Link>
      </div>
    </div>
  );
}
