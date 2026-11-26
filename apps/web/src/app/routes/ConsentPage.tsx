import { useState } from 'react';
import { LogoutButton, useLogoutFeedback } from '@/app/layout/LogoutButton';
import { AuthScreen } from '@/features/auth/components/AuthScreen';
import { ConsentForm } from '@/features/auth/components/ConsentForm';
import { DeleteAccountDialog } from '@/features/auth/components/DeleteAccountDialog';
import { pageTitle } from '@/shared/config/app';
import { useMe } from '@/shared/session/hooks/useMe';
import { Button } from '@/shared/ui/Button';
import styles from './ConsentPage.module.scss';

/**
 * `/consent`, the re-consent to a new policy version (docs/plans/auth-screens.md §3, D38). Refusing
 * means deleting the account: the same dialog as in `/settings`.
 */
export function ConsentPage() {
  const { currentPolicyVersion } = useMe();
  const [isDeleting, setIsDeleting] = useState(false);
  useLogoutFeedback();
  return (
    <AuthScreen
      variant="onboarding"
      title="Notre politique a changé"
      subtitle="Relis-la et confirme ton accord pour continuer à utiliser ton carnet."
      footer={
        <LogoutButton>
          {(isPending) => (isPending ? 'Déconnexion…' : 'Se déconnecter')}
        </LogoutButton>
      }
    >
      <title>{pageTitle('Consentement')}</title>
      <ConsentForm policyVersion={currentPolicyVersion} />
      <div className={styles.refusal}>
        <p className={styles.text}>
          Tu ne veux pas donner ton accord ? Sans lui, ton carnet ne peut pas être conservé.
        </p>
        <Button className={styles.delete} onClick={() => setIsDeleting(true)}>
          Supprimer mon compte
        </Button>
      </div>
      {isDeleting && <DeleteAccountDialog onCancel={() => setIsDeleting(false)} />}
    </AuthScreen>
  );
}
