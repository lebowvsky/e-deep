import styles from './DashboardPage.module.scss';

/** Dashboard — content arrives in phase 3 (header, KPI, map, last dive, chart, buddies). */
export function DashboardPage() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Tableau de bord</h1>
    </header>
  );
}
