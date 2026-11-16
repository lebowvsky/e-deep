import { useId } from 'react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Overline } from '@/shared/ui/Overline';
import styles from './DivesError.module.scss';

export interface DivesErrorProps {
  onRetry: () => void;
  /** What could not be loaded. Default: the dive log. */
  message?: string;
  /** Eyebrow above the message. Default « Connexion ». */
  overline?: string;
  /** What to do next. Default: check the connection. */
  hint?: string;
}

const DEFAULT_MESSAGE = 'Impossible de charger tes plongées pour l’instant.';
const DEFAULT_OVERLINE = 'Connexion';
const DEFAULT_HINT = 'Vérifie ta connexion, puis réessaie.';

/**
 * The dive log could not be loaded (not in the mockups): message and retry, layout kept. The page
 * live region announces the failure.
 */
export function DivesError({
  onRetry,
  message = DEFAULT_MESSAGE,
  overline = DEFAULT_OVERLINE,
  hint = DEFAULT_HINT,
}: DivesErrorProps) {
  const messageId = useId();
  return (
    <Card as="section" padding="lg" className={styles.card} aria-labelledby={messageId}>
      <Overline>{overline}</Overline>
      <p id={messageId} className={styles.message}>
        {message}
      </p>
      <p className={styles.hint}>{hint}</p>
      <Button className={styles.retry} onClick={onRetry}>
        Réessayer
      </Button>
    </Card>
  );
}
