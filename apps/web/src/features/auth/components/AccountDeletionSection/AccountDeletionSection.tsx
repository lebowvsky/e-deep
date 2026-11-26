import type { MeResponse } from '@e-deep/shared';
import { useState } from 'react';
import { formatLongDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { DeleteAccountDialog } from '../DeleteAccountDialog';
import { SettingsSection } from '../SettingsSection';
import styles from './AccountDeletionSection.module.scss';

export interface AccountDeletionSectionProps {
  /** The live consent, `null` if none is on record. */
  consent: MeResponse['consent'];
}

/**
 * « Consentement et suppression du compte » (docs/plans/auth-screens.md §4.4, D38): when the diver
 * gave their consent, then the danger zone: withdrawing it means deleting the account.
 */
export function AccountDeletionSection({ consent }: AccountDeletionSectionProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <SettingsSection title="Consentement et suppression du compte">
      {consent !== null && (
        <p className={styles.text}>
          Tu as donné ton accord le{' '}
          <time dateTime={consent.grantedAt} className={styles.figure}>
            {formatLongDate(consent.grantedAt)}
          </time>{' '}
          (version <span className={styles.figure}>{consent.policyVersion}</span>).
        </p>
      )}
      <div className={styles.danger}>
        <h3 className={styles.dangerTitle}>Supprimer mon compte</h3>
        <p className={styles.text}>
          Ton compte, ton carnet, tes sites et tes binômes sont effacés définitivement. Retirer ton
          accord revient à supprimer ton compte.
        </p>
        <Button variant="danger" className={styles.button} onClick={() => setIsDeleting(true)}>
          Supprimer mon compte
        </Button>
      </div>
      {isDeleting && <DeleteAccountDialog onCancel={() => setIsDeleting(false)} />}
    </SettingsSection>
  );
}
