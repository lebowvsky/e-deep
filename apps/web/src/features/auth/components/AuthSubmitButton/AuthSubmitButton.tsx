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
  /** Nothing can be sent yet, for a reason said elsewhere (the levels of `/welcome` not loaded). */
  isBlocked?: boolean;
  children: ReactNode;
}

/**
 * Submit of the auth forms: full width, 48px. While the call runs, the API asks to wait or the form
 * is blocked, it stays focusable but submits nothing (`aria-disabled`; the form refuses the submit).
 */
export function AuthSubmitButton({
  isPending,
  pendingLabel,
  retryLeft,
  isBlocked = false,
  children,
}: AuthSubmitButtonProps) {
  const isWaiting = retryLeft > 0;
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      className={styles.submit}
      aria-disabled={isPending || isWaiting || isBlocked || undefined}
      aria-busy={isPending || undefined}
    >
      {isPending ? pendingLabel : children}
      {isWaiting && <span className={styles.countdown}>{formatCountdown(retryLeft)}</span>}
    </Button>
  );
}
