import type { ReactNode } from 'react';
import { formatCountdown } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import styles from './AuthSubmitButton.module.scss';

export interface AuthSubmitButtonProps {
  isPending: boolean;
  /** « Connexion… », « Création… ». */
  pendingLabel: string;
  /** Seconds before a new try is allowed (`429`); `0`: allowed. */
  retryLeft: number;
  children: ReactNode;
}

/**
 * Submit of the sign-in and sign-up forms: full width, 48px. While the call runs or the API asks
 * to wait, it stays focusable but submits nothing (`aria-disabled`; the form refuses the submit).
 */
export function AuthSubmitButton({
  isPending,
  pendingLabel,
  retryLeft,
  children,
}: AuthSubmitButtonProps) {
  const isWaiting = retryLeft > 0;
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      className={styles.submit}
      aria-disabled={isPending || isWaiting || undefined}
      aria-busy={isPending || undefined}
    >
      {isPending ? pendingLabel : children}
      {isWaiting && <span className={styles.countdown}>{formatCountdown(retryLeft)}</span>}
    </Button>
  );
}
