import { CardStackSkeleton } from '@/components/admin/skeletons/CardStackSkeleton';

export default function Loading() {
  return <CardStackSkeleton cards={4} rowsPerCard={3} />;
}
