import { useRef } from 'react';
import { useLocation, useParams } from 'react-router';
import { mockUser } from '@/features/dashboard/mocks/dashboard';
import { DivesError } from '@/features/dives/components/DivesError';
import { DiveDetailNav } from '@/features/dives/components/detail/DiveDetailNav';
import { DiveDetailReady } from '@/features/dives/components/detail/DiveDetailReady';
import { DiveDetailSkeleton } from '@/features/dives/components/detail/DiveDetailSkeleton';
import { DiveNotFound } from '@/features/dives/components/detail/DiveNotFound';
import { DivePager } from '@/features/dives/components/detail/DivePager';
import { useDive } from '@/features/dives/hooks/useDive';
import { backToLogHref, forwardLinkState } from '@/features/dives/lib/backLink';
import { DIVE_LOAD_ERROR_MESSAGE, diveDetailAnnouncement } from '@/features/dives/lib/labels';
import type { DiveDetailState, DiveNeighbours } from '@/features/dives/types';
import { pageTitle } from '@/shared/config/app';
import styles from './DiveDetailPage.module.scss';

/** Logbook number of the dive, once the detail or the cached log knows it. */
function diveNumberOf(state: DiveDetailState): number | null {
  if (state.status === 'ready') return state.dive.number;
  if (state.status === 'loading') return state.preview?.number ?? null;
  return null;
}

/** Previous / next dives: from the log insights, or the preview while the detail loads. */
function neighboursOf(state: DiveDetailState): DiveNeighbours | null {
  if (state.status === 'ready') return state.insights;
  if (state.status === 'loading') return state.neighbours;
  return null;
}

function titleOf(state: DiveDetailState, number: number | null): string {
  if (state.status === 'not-found') return 'Plongée introuvable';
  return number === null ? 'Plongée' : `Plongée #${number}`;
}

/** The site is the h1 of a known dive, the message that of not-found; the others need one. */
function hasOwnHeading(state: DiveDetailState): boolean {
  return (
    state.status === 'ready' ||
    state.status === 'not-found' ||
    (state.status === 'loading' && state.preview !== null)
  );
}

/** « Détail d'une plongée »: one dive of the log, leafed through in chronological order. */
export function DiveDetailPage() {
  // The route always has the segment; an empty one would only reach a 404 (not-found).
  const { diveId = '' } = useParams();
  const location = useLocation();
  // TODO(auth): the user will come from the session, as in AppShell.
  const state = useDive(diveId, mockUser);
  const contentRef = useRef<HTMLDivElement>(null);
  const backHref = backToLogHref(location.state);
  const linkState = forwardLinkState(location.state);
  const number = diveNumberOf(state);
  const neighbours = neighboursOf(state);

  // The retry button is about to be replaced by the skeleton: focus its persistent container
  // first, so that keyboard and reader users are not sent back to the top of the document.
  const handleRetry = () => {
    contentRef.current?.focus();
    if (state.status === 'error') state.retry();
  };

  return (
    <div className={styles.page}>
      <title>{pageTitle(titleOf(state, number))}</title>
      {!hasOwnHeading(state) && <h1 className={styles.srOnly}>Détail de la plongée</h1>}
      <DiveDetailNav
        backHref={backHref}
        number={number}
        neighbours={neighbours}
        linkState={linkState}
      />
      {/* Rendered from the first render and never swapped, so that each state is announced. */}
      <p className={styles.srOnly} role="status">
        {diveDetailAnnouncement(state)}
      </p>
      <div ref={contentRef} className={styles.content} tabIndex={-1}>
        <DiveDetailContent state={state} backHref={backHref} onRetry={handleRetry} />
      </div>
      {/* Phones leaf through with tiles at the bottom; larger screens with the bar buttons. */}
      {neighbours && (
        <DivePager
          previous={neighbours.previous}
          next={neighbours.next}
          linkState={linkState}
          variant="tiles"
          className={styles.tiles}
        />
      )}
    </div>
  );
}

interface DiveDetailContentProps {
  state: DiveDetailState;
  backHref: string;
  onRetry: () => void;
}

function DiveDetailContent({ state, backHref, onRetry }: DiveDetailContentProps) {
  switch (state.status) {
    case 'ready':
      return <DiveDetailReady dive={state.dive} insights={state.insights} />;
    case 'loading':
      return <DiveDetailSkeleton preview={state.preview} />;
    case 'not-found':
      return <DiveNotFound backHref={backHref} />;
    case 'error':
      return <DivesError message={DIVE_LOAD_ERROR_MESSAGE} onRetry={onRetry} />;
  }
}
