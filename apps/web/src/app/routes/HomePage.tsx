import { HealthPanel } from '@/features/health/components/HealthPanel';
import styles from './HomePage.module.scss';

export function HomePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>E-Deep</h1>
      <HealthPanel />
    </main>
  );
}
