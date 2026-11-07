import { DashboardEmpty } from '@/features/dashboard/components/DashboardEmpty';
import { DashboardReady } from '@/features/dashboard/components/DashboardReady';
import { DashboardSkeleton } from '@/features/dashboard/components/DashboardSkeleton';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';

/** Dashboard route: renders the component matching the loader state. */
export function DashboardPage() {
  const state = useDashboard();

  switch (state.status) {
    case 'ready':
      return <DashboardReady data={state.data} />;
    case 'empty':
      return <DashboardEmpty user={state.user} />;
    case 'loading':
      return <DashboardSkeleton />;
  }
}
