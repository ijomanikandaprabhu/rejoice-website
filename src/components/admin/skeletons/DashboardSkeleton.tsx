import { AdminSkeleton } from '@/components/admin/skeletons/AdminSkeleton';
import { ScreenHeaderSkeleton } from '@/components/admin/skeletons/ScreenHeaderSkeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/** One statistic: a label, a large number, and a note beneath. */
function TileSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <AdminSkeleton className="h-3.5 w-24" />
        <AdminSkeleton className="h-8 w-20" />
      </CardHeader>
      <CardContent>
        <AdminSkeleton className="h-3.5 w-28" />
      </CardContent>
    </Card>
  );
}

/**
 * One chart card. The body is a fixed 220px block because that is what
 * `GrowthChart` and `CatalogueChart` reserve (`h-[220px]`) — a chart that
 * measured itself into a differently sized box would shift everything below it
 * when the real one rendered.
 */
function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <AdminSkeleton className="h-5 w-36" />
        <AdminSkeleton className="h-4 w-56 max-w-full" />
      </CardHeader>
      <CardContent>
        <AdminSkeleton className="h-[220px] w-full" />
      </CardContent>
    </Card>
  );
}

/**
 * The dashboard: two bands of statistic tiles, then rows of chart cards.
 *
 * The grid classes are copied from `src/app/admin/page.tsx` deliberately
 * (`sm:grid-cols-2 xl:grid-cols-4` for the tiles, `lg:grid-cols-3` for the
 * charts) so the placeholder wraps at exactly the same breakpoints the real
 * screen does.
 */
export function DashboardSkeleton() {
  return (
    <>
      <ScreenHeaderSkeleton />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <TileSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <TileSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ChartCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ChartCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
