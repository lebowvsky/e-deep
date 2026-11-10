import { useState } from 'react';
import { mockUser } from '@/features/dashboard/mocks/dashboard';
import { DivesHeader } from '@/features/dives/components/DivesHeader';
import { DivesReady } from '@/features/dives/components/DivesReady';
import { useDives } from '@/features/dives/hooks/useDives';
import { useDivesQuery } from '@/features/dives/hooks/useDivesQuery';
import { pageTitle } from '@/shared/config/app';
import { useToast } from '@/shared/ui/Toast';
import styles from './DivesPage.module.scss';

const COMING_SOON = 'Bientôt disponible';

/** « Mes plongées »: the dive log, its selection in the URL. */
export function DivesPage() {
  const [query, updateQuery] = useDivesQuery();
  const [now] = useState(() => new Date());
  const state = useDives(query, now);
  const { notify } = useToast();
  // TODO(auth): the level will come from the session, as in AppShell.
  const { level, federation } = mockUser;

  return (
    <div className={styles.page}>
      <title>{pageTitle('Mes plongées')}</title>
      <DivesHeader
        level={level}
        federation={federation}
        log={state.status === 'ready' ? state.log : null}
        onExport={() => notify(COMING_SOON)}
      />
      {/* TODO(phase 4): loading, empty and error states. */}
      {state.status === 'ready' && (
        <DivesReady state={state} query={query} onChange={updateQuery} now={now} />
      )}
    </div>
  );
}
