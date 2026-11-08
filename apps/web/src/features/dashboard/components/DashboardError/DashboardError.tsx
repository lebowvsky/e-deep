import { useId } from 'react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Overline } from '@/shared/ui/Overline';
import styles from './DashboardError.module.scss';

export interface DashboardErrorProps {
  onRetry: () => void;
}

/** The dashboard could not be loaded (API unreachable, timeout, unexpected answer). */
export function DashboardError({ onRetry }: DashboardErrorProps) {
  const messageId = useId();

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>Tableau de bord</h1>
      <Card as="section" padding="lg" className={styles.card} aria-labelledby={messageId}>
        <Overline>Connexion</Overline>
        <p id={messageId} role="alert" className={styles.message}>
          Impossible de charger ton carnet pour l’instant.
        </p>
        <p className={styles.hint}>Vérifie ta connexion, puis réessaie.</p>
        <Button className={styles.retry} onClick={onRetry}>
          Réessayer
        </Button>
      </Card>
    </div>
  );
}
