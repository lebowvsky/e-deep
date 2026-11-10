import { useState } from 'react';
import { mockUser } from '@/features/dashboard/mocks/dashboard';
import { DivesEmpty } from '@/features/dives/components/DivesEmpty';
import { DivesError } from '@/features/dives/components/DivesError';
import { DivesHeader } from '@/features/dives/components/DivesHeader';
import { DivesReady } from '@/features/dives/components/DivesReady';
import { DivesSkeleton } from '@/features/dives/components/DivesSkeleton';
import { useDives } from '@/features/dives/hooks/useDives';
import { useDivesQuery } from '@/features/dives/hooks/useDivesQuery';
import type { DivesQuery, DivesState } from '@/features/dives/types';
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
  const comingSoon = () => notify(COMING_SOON);

  return (
    <div className={styles.page}>
      <title>{pageTitle('Mes plongées')}</title>
      <DivesHeader
        level={level}
        federation={federation}
        log={state.status === 'ready' ? state.log : null}
        showActions={state.status !== 'empty'}
        onExport={comingSoon}
      />
      <DivesContent
        state={state}
        query={query}
        onChange={updateQuery}
        now={now}
        onImport={comingSoon}
      />
    </div>
  );
}

interface DivesContentProps {
  state: DivesState;
  query: DivesQuery;
  onChange: Parameters<typeof DivesReady>[0]['onChange'];
  now: Date;
  onImport: () => void;
}

function DivesContent({ state, query, onChange, now, onImport }: DivesContentProps) {
  switch (state.status) {
    case 'ready':
      return <DivesReady state={state} query={query} onChange={onChange} now={now} />;
    case 'empty':
      return <DivesEmpty onImport={onImport} />;
    case 'error':
      return <DivesError onRetry={state.retry} />;
    case 'loading':
      return <DivesSkeleton />;
  }
}
