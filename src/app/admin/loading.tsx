import { DashboardSkeleton } from '@/components/admin/skeletons/DashboardSkeleton';

/*
 * This boundary covers /admin/login as well, which has no data to wait for — but
 * the login page is reached unauthenticated and the middleware redirect resolves
 * before any of this renders, so in practice it is never seen there.
 */
export default function Loading() {
  return <DashboardSkeleton />;
}
