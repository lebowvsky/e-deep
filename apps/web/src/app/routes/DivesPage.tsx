import { useRef, useState } from 'react';
import { mockUser } from '@/features/dashboard/mocks/dashboard';
import { DivesEmpty } from '@/features/dives/components/DivesEmpty';
import { DivesError } from '@/features/dives/components/DivesError';
import { DivesHeader } from '@/features/dives/components/DivesHeader';
import { DivesReady } from '@/features/dives/components/DivesReady';
import { DivesSkeleton } from '@/features/dives/components/DivesSkeleton';
import { useDives } from '@/features/dives/hooks/useDives';
import { useDivesQuery } from '@/features/dives/hooks/useDivesQuery';
import { stateAnnouncement } from '@/features/dives/lib/labels';
import type { DivesQuery, DivesState } from '@/features/dives/types';
import { pageTitle } from '@/shared/config/app';
import { useToast } from '@/shared/ui/Toast';
import styles from './DivesPage.module.scss';

const COMING_SOON = 'Bientôt disponible';

/** « Mes plongées »: the dive log, its selection in the URL. */
export function DivesPage() {
  const [query, updateQuery] = useDivesQuery();
  const [now] = useState(() => new Date());
  // TODO(auth): the user (identity, level) will come from the session, as in AppShell.
  const state = useDives(query, now, mockUser);
  const { notify } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const { level, federation } = mockUser;
  const comingSoon = () => notify(COMING_SOON);

  // The retry button is about to be replaced by the skeleton: focus its persistent container
  // first, so that keyboard and reader users are not sent back to the top of the document.
  const handleRetry = () => {
    contentRef.current?.focus();
    if (state.status === 'error') state.retry();
  };

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
      {/*
        Rendered from the first render and never swapped (unlike the content below), so that each
        change — loaded, failed, size of the selection after a filter — is announced.
      */}
      <p className={styles.srOnly} role="status">
        {stateAnnouncement(state)}
      </p>
      <div ref={contentRef} className={styles.content} tabIndex={-1}>
        <DivesContent
          state={state}
          query={query}
          onChange={updateQuery}
          now={now}
          onImport={comingSoon}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}

interface DivesContentProps {
  state: DivesState;
  query: DivesQuery;
  onChange: Parameters<typeof DivesReady>[0]['onChange'];
  now: Date;
  onImport: () => void;
  onRetry: () => void;
}

function DivesContent({ state, query, onChange, now, onImport, onRetry }: DivesContentProps) {
  switch (state.status) {
    case 'ready':
      return <DivesReady state={state} query={query} onChange={onChange} now={now} />;
    case 'empty':
      return <DivesEmpty onImport={onImport} />;
    case 'error':
      return <DivesError onRetry={onRetry} />;
    case 'loading':
      return <DivesSkeleton />;
  }
}
