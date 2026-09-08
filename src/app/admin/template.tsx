import { AdminScreen } from '@/components/admin/AdminScreen';

/**
 * A template, not more layout: Next re-renders this on every navigation, which
 * is the hook the entrance animation needs. The layout stays put, so the top bar
 * and its notification query are not re-run on every click.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <AdminScreen>{children}</AdminScreen>;
}
