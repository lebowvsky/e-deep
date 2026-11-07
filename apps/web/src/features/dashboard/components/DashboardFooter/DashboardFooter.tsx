import { APP_NAME } from '@/shared/config/app';
import styles from './DashboardFooter.module.scss';

/** Discreet product footnote (dashboard-desktop.jsx). */
export function DashboardFooter() {
  return (
    <footer className={styles.footer}>
      <span>{APP_NAME} V1 · Dashboard</span>
      <span aria-hidden="true">·</span>
      <span>WCAG AA partout · AAA sur KPI</span>
      <span aria-hidden="true">·</span>
      <span>Données santé non affichées</span>
    </footer>
  );
}
