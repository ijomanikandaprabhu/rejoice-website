import { TableScreenSkeleton } from '@/components/admin/skeletons/TableScreenSkeleton';

export default function Loading() {
  // `action` reserves the "Add song" button, which the other tables do not have.
  return <TableScreenSkeleton columns={8} action />;
}
