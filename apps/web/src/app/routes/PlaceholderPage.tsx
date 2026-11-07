import { ButtonLink } from '@/shared/ui/Button';
import styles from './PlaceholderPage.module.scss';

export interface PlaceholderPageProps {
  title: string;
  message?: string;
}

/** Destination for actions whose screen is not built yet: never a dead link. */
export function PlaceholderPage({
  title,
  message = 'Cette page arrive bientôt.',
}: PlaceholderPageProps) {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
      <ButtonLink to="/dashboard" icon="dashboard">
        Retour au tableau de bord
      </ButtonLink>
    </section>
  );
}
