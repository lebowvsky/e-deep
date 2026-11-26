import { AccountDeletionSection } from '@/features/auth/components/AccountDeletionSection';
import { AccountSummary } from '@/features/auth/components/AccountSummary';
import { LogoutAllSection } from '@/features/auth/components/LogoutAllSection';
import { PasswordChangeForm } from '@/features/auth/components/PasswordChangeForm';
import { SettingsSection } from '@/features/auth/components/SettingsSection';
import { pageTitle } from '@/shared/config/app';
import { useMe } from '@/shared/session/hooks/useMe';
import styles from './SettingsPage.module.scss';

/**
 * `/settings` (docs/plans/auth-screens.md §4): the account, read only, the password, the signed-in
 * devices, then the consent and the deletion of the account; one card per section.
 */
export function SettingsPage() {
  const { account, diver, consent } = useMe();
  return (
    <div className={styles.page}>
      <title>{pageTitle('Paramètres')}</title>
      <h1 className={styles.title}>Paramètres</h1>
      <AccountSummary account={account} diver={diver} />
      <SettingsSection title="Mot de passe">
        <PasswordChangeForm email={account.email} />
      </SettingsSection>
      <LogoutAllSection />
      <AccountDeletionSection consent={consent} />
    </div>
  );
}
