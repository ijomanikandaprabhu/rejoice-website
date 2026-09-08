import { AdminSkeleton } from '@/components/admin/skeletons/AdminSkeleton';

/**
 * The title and one-line description every admin screen opens with.
 *
 * BARS, NEVER TEXT, and never a real `<h1>`. The end-to-end suite signs in and
 * then waits for `getByRole('heading', { name: 'Dashboard' })` to decide the
 * admin has loaded. A skeleton heading carrying that name would satisfy that
 * wait while the screen was still empty — the test would go green over a
 * regression it exists to catch.
 *
 * Heights match the real type: `text-2xl` and `text-sm` with their line boxes.
 */
export function ScreenHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <AdminSkeleton className="h-8 w-44" />
        <AdminSkeleton className="h-4 w-64" />
      </div>
      {/* Screens with a primary button keep its footprint, or the row reflows. */}
      {action ? <AdminSkeleton className="h-9 w-28 rounded-pill" /> : null}
    </div>
  );
}
