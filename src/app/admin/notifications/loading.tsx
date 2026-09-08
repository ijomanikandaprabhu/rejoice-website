import { CardStackSkeleton } from '@/components/admin/skeletons/CardStackSkeleton';

export default function Loading() {
  // One card holding the history list, so it stands taller than it is wide.
  return <CardStackSkeleton cards={1} rowsPerCard={8} />;
}
