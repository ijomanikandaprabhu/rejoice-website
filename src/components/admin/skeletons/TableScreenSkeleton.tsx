import { AdminSkeleton } from '@/components/admin/skeletons/AdminSkeleton';
import { ScreenHeaderSkeleton } from '@/components/admin/skeletons/ScreenHeaderSkeleton';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Enquiries, Songs and YouTube Content are the same screen with different
 * columns: a header, a toolbar, one bordered card holding a table, and a
 * pagination strip.
 *
 * Built from the REAL `Card` and `Table` primitives rather than plain divs. That
 * is what keeps the swap silent: row height, cell padding and border colour all
 * come from the same CSS the loaded screen uses, so when the data lands only the
 * contents of each cell change. A hand-rolled approximation would be a few
 * pixels out per row and the whole page would jump.
 */
export function TableScreenSkeleton({
  rows = 10,
  columns = 6,
  action = false,
}: {
  rows?: number;
  columns?: number;
  action?: boolean;
}) {
  return (
    <>
      <ScreenHeaderSkeleton action={action} />

      {/* Search field and filter pills. */}
      <div className="flex flex-wrap items-center gap-2">
        <AdminSkeleton className="h-9 w-full max-w-xs" />
        <AdminSkeleton className="h-9 w-24 rounded-pill" />
        <AdminSkeleton className="h-9 w-24 rounded-pill" />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <AdminSkeleton className="h-3.5 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, r) => (
              <TableRow key={r}>
                {Array.from({ length: columns }).map((_, c) => (
                  <TableCell key={c}>
                    {/*
                     * The first cell is narrow (a checkbox or index) and the
                     * second wide (the title); the rest sit between. Varying the
                     * widths stops the block reading as a grid of identical
                     * boxes, which looks like a rendering fault rather than
                     * something arriving.
                     */}
                    <AdminSkeleton
                      className={c === 0 ? 'h-4 w-4' : c === 1 ? 'h-4 w-48' : 'h-4 w-24'}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <AdminSkeleton className="h-4 w-40" />
        <AdminSkeleton className="h-9 w-48" />
      </div>
    </>
  );
}
