import { APP_NAME, pageTitle } from '@/shared/config/app';
import { HealthPanel } from '@/features/health/components/HealthPanel';
import styles from './StatusPage.module.scss';

/** Technical page: the API health, outside the app frame. */
export function StatusPage() {
  return (
    <main className={styles.page}>
      <title>{pageTitle('État de l’API')}</title>
      <h1 className={styles.title}>{APP_NAME}</h1>
      <HealthPanel />
    </main>
  );
}
