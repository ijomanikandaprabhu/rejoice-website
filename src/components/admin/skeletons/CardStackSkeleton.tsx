import { AdminSkeleton } from '@/components/admin/skeletons/AdminSkeleton';
import { ScreenHeaderSkeleton } from '@/components/admin/skeletons/ScreenHeaderSkeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Settings, YouTube Channels and Notifications are a column of cards.
 *
 * `rowsPerCard` stands in for a card's body: form fields on Settings, a channel
 * summary, a list of notifications. It only has to be about the right height —
 * these screens have no fixed row count to match, so the aim is a page of
 * roughly the right length rather than a pixel-exact stand-in.
 */
export function CardStackSkeleton({
  cards = 3,
  rowsPerCard = 3,
  action = false,
}: {
  cards?: number;
  rowsPerCard?: number;
  action?: boolean;
}) {
  return (
    <>
      <ScreenHeaderSkeleton action={action} />

      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="gap-2">
            <AdminSkeleton className="h-5 w-40" />
            <AdminSkeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: rowsPerCard }).map((_, r) => (
              <div key={r} className="flex flex-col gap-2">
                <AdminSkeleton className="h-3.5 w-28" />
                <AdminSkeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
