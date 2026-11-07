import { APP_NAME, pageTitle } from '@/shared/config/app';
import { HealthPanel } from '@/features/health/components/HealthPanel';
import styles from './HomePage.module.scss';

export function HomePage() {
  return (
    <main className={styles.page}>
      <title>{pageTitle('État de l’API')}</title>
      <h1 className={styles.title}>{APP_NAME}</h1>
      <HealthPanel />
    </main>
  );
}
