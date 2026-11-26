import type { MeResponse } from '@e-deep/shared';
import { formatDiverLevel, formatFullName } from '@/shared/lib/format';
import { SettingsSection } from '../SettingsSection';
import styles from './AccountSummary.module.scss';

export interface AccountSummaryProps {
  account: MeResponse['account'];
  diver: MeResponse['diver'];
}

/**
 * « Compte » of `/settings` (docs/plans/auth-screens.md §4.1): who is signed in, read only. The
 * profile cannot be edited yet: no button, no dead link.
 */
export function AccountSummary({ account, diver }: AccountSummaryProps) {
  const rows = [
    { term: 'Prénom et nom', value: formatFullName(diver.firstName, diver.lastName) },
    { term: 'E-mail', value: account.email },
    {
      term: 'Niveau',
      value: diver.level === null ? '—' : formatDiverLevel(diver.level.label, diver.level.agency),
    },
  ];
  return (
    <SettingsSection title="Compte">
      <dl className={styles.list}>
        {rows.map(({ term, value }) => (
          <div key={term} className={styles.row}>
            <dt className={styles.term}>{term}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}
