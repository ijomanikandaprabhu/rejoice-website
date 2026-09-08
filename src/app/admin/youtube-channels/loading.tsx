import { CardStackSkeleton } from '@/components/admin/skeletons/CardStackSkeleton';

export default function Loading() {
  // The "Add channel" card, then one card per connected channel.
  return <CardStackSkeleton cards={3} rowsPerCard={2} />;
}
