import type { ReactNode } from 'react';
import { pageTitle } from '@/shared/config/app';
import { ButtonLink } from '@/shared/ui/Button';
import styles from './PlaceholderPage.module.scss';

export interface PlaceholderPageProps {
  title: string;
  message?: string;
  /** What the visitor can do; a link back to the dashboard by default. */
  actions?: ReactNode;
}

/** Destination for actions whose screen is not built yet: never a dead link. */
export function PlaceholderPage({
  title,
  message = 'Cette page arrive bientôt.',
  actions = (
    <ButtonLink to="/dashboard" icon="dashboard">
      Retour au tableau de bord
    </ButtonLink>
  ),
}: PlaceholderPageProps) {
  return (
    <section className={styles.page}>
      <title>{pageTitle(title)}</title>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}
