import { DashboardReady } from '@/features/dashboard/components/DashboardReady';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import styles from './DashboardPage.module.scss';

/** Dashboard route: renders the component matching the loader state. */
export function DashboardPage() {
  const state = useDashboard();

  switch (state.status) {
    case 'ready':
      return <DashboardReady data={state.data} />;
    // TODO(phase 4): DashboardSkeleton (mockup 03) and DashboardEmpty (mockup 02).
    case 'loading':
      return (
        <div className={styles.pending} aria-busy="true">
          <h1 className={styles.title}>Tableau de bord</h1>
          <p role="status">Chargement du tableau de bord…</p>
        </div>
      );
    case 'empty':
      return (
        <div className={styles.pending}>
          <h1 className={styles.title}>Bienvenue à bord, {state.user.firstName}</h1>
        </div>
      );
  }
}
