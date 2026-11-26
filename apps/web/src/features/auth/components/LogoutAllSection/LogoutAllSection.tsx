import { useState, useTransition } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '@/shared/lib/apiClient';
import { AuthError } from '@/shared/session/authClient';
import { useEndSession } from '@/shared/session/hooks/useEndSession';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { SettingsSection } from '../SettingsSection';
import styles from './LogoutAllSection.module.scss';

/** Where the diver lands once signed out everywhere: the landing page, as after a logout. */
const AFTER_LOGOUT_PATH = '/';

const LOGOUT_ALL_FAILED =
  'La déconnexion des appareils n’a pas abouti. Vérifie ton réseau et réessaie.';

/**
 * « Appareils connectés » (docs/plans/auth-screens.md §4.3): every session of the account closed,
 * this one included, after a confirmation; then the same local cleanup as a logout. A failure
 * changes nothing and says so.
 */
export function LogoutAllSection() {
  const endSession = useEndSession();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setIsConfirming(false);
    startTransition(async () => {
      try {
        await endSession({ kind: 'logout-all' });
      } catch (error) {
        // An answer that is not a success: the sessions are still open. Anything else is a bug.
        if (!(error instanceof ApiError || error instanceof AuthError)) throw error;
        notify(LOGOUT_ALL_FAILED);
        return;
      }
      await navigate(AFTER_LOGOUT_PATH, { replace: true });
    });
  };

  return (
    <SettingsSection title="Appareils connectés">
      <p className={styles.text}>
        Tu t’es connecté sur un appareil qui ne t’appartient pas ? Déconnecte-les tous, y compris
        celui-ci.
      </p>
      <Button
        className={styles.button}
        aria-disabled={isPending || undefined}
        aria-busy={isPending || undefined}
        onClick={isPending ? undefined : () => setIsConfirming(true)}
      >
        {isPending ? 'Déconnexion…' : 'Déconnecter tous les appareils'}
      </Button>
      <ConfirmDialog
        open={isConfirming}
        title="Déconnecter tous les appareils ?"
        description="Tu devras te reconnecter partout, y compris sur cet appareil."
        cancelLabel="Annuler"
        confirmLabel="Tout déconnecter"
        onCancel={() => setIsConfirming(false)}
        onConfirm={handleConfirm}
      />
    </SettingsSection>
  );
}
