import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container-page flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="t-label">Error 404</p>
      <h1 className="t-h1 mt-5">This page does not exist</h1>
      <p className="mt-4 max-w-md text-body leading-[1.7] text-site-muted">
        The page you asked for is not here. It may have moved, or the link may be old.
      </p>
      <Link href="/" className="btn-primary mt-9">
        Back to home
      </Link>
    </main>
  );
}
