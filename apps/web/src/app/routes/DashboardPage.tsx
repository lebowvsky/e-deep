import { DashboardEmpty } from '@/features/dashboard/components/DashboardEmpty';
import { DashboardReady } from '@/features/dashboard/components/DashboardReady';
import { DashboardSkeleton } from '@/features/dashboard/components/DashboardSkeleton';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { pageTitle } from '@/shared/config/app';

/** Dashboard route: renders the component matching the loader state. */
export function DashboardPage() {
  const state = useDashboard();

  return (
    <>
      <title>{pageTitle('Tableau de bord')}</title>
      <DashboardContent state={state} />
    </>
  );
}

function DashboardContent({ state }: { state: ReturnType<typeof useDashboard> }) {
  switch (state.status) {
    case 'ready':
      return <DashboardReady data={state.data} />;
    case 'empty':
      return <DashboardEmpty user={state.user} />;
    case 'loading':
      return <DashboardSkeleton />;
  }
}
