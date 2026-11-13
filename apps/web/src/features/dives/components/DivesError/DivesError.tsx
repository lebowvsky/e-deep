import { useId } from 'react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Overline } from '@/shared/ui/Overline';
import styles from './DivesError.module.scss';

export interface DivesErrorProps {
  onRetry: () => void;
}

/**
 * The dive log could not be loaded (not in the mockups): message and retry, layout kept. The page
 * live region announces the failure.
 */
export function DivesError({ onRetry }: DivesErrorProps) {
  const messageId = useId();
  return (
    <Card as="section" padding="lg" className={styles.card} aria-labelledby={messageId}>
      <Overline>Connexion</Overline>
      <p id={messageId} className={styles.message}>
        Impossible de charger tes plongées pour l’instant.
      </p>
      <p className={styles.hint}>Vérifie ta connexion, puis réessaie.</p>
      <Button className={styles.retry} onClick={onRetry}>
        Réessayer
      </Button>
    </Card>
  );
}
