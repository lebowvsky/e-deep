import type { CertificationLevelRef } from '@e-deep/shared';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { mockUser } from '@/features/dashboard/mocks/dashboard';
import { DivesError } from '@/features/dives/components/DivesError';
import { DiveNotFound } from '@/features/dives/components/detail/DiveNotFound';
import {
  DiveForm,
  type DiveFormPrefill,
  type DiveFormProps,
} from '@/features/dives/components/form/DiveForm';
import { DiveFormSkeleton } from '@/features/dives/components/form/DiveFormSkeleton';
import type { DiveFormTarget } from '@/features/dives/form/convert';
import { createLocalDraftStore, draftKey } from '@/features/dives/form/draftStore';
import { TEAM_LEVELS, type DiveFormValues } from '@/features/dives/form/model';
import {
  duplicateDiveValues,
  editDiveValues,
  editTarget,
  findResumeSuggestion,
  newDiveValues,
  type DiveFormMode,
} from '@/features/dives/form/prefill';
import { takenNumbers, type DiveFormSources } from '@/features/dives/form/sources';
import { toDayValue } from '@/features/dives/form/timeLink';
import { useDiveFormSources } from '@/features/dives/form/useDiveFormSources';
import { useDive } from '@/features/dives/hooks/useDive';
import { useSaveDive } from '@/features/dives/hooks/useSaveDive';
import { DIVE_LOAD_ERROR_HINT, DIVE_LOAD_ERROR_MESSAGE } from '@/features/dives/lib/labels';
import type { DiveDetailView, LoggedDive } from '@/features/dives/types';
import { pageTitle } from '@/shared/config/app';

// TODO(auth): the diver will come from the session, as in AppShell.
const DIVER = mockUser;
const DIVER_LEVEL: CertificationLevelRef = {
  agency: DIVER.federation,
  code: DIVER.level,
  label: TEAM_LEVELS.find(({ code }) => code === DIVER.level)?.label ?? DIVER.level,
};
const SELF = { firstName: DIVER.firstName, lastName: DIVER.lastName, level: DIVER.level };
/** V1: every diver creates their own dives, so every field is theirs to edit. */
const CAN_EDIT_EVENT = true;
const draftStore = createLocalDraftStore();

/** `/dives/:diveId/edit`, `/dives/new?from=:id`, or `/dives/new`. */
function useDiveFormMode(): DiveFormMode {
  const { diveId } = useParams();
  const [searchParams] = useSearchParams();
  const sourceId = searchParams.get('from');
  if (diveId !== undefined) return { kind: 'edit', diveId };
  if (sourceId !== null && sourceId !== '') return { kind: 'duplicate', sourceId };
  return { kind: 'new' };
}

const titleOf = (mode: DiveFormMode) =>
  mode.kind === 'edit' ? 'Modifier la plongée' : 'Nouvelle plongée';

/**
 * « Nouvelle plongée », its duplicate and « Modifier la plongée ». Waits for the log (next number,
 * numbers taken) and, when needed, for the source dive, then mounts the form once per mode.
 */
export function DiveFormPage() {
  const mode = useDiveFormMode();
  const sources = useDiveFormSources(DIVER);
  const title = titleOf(mode);

  return (
    <>
      <title>{pageTitle(title)}</title>
      {sources.status === 'loading' && <DiveFormSkeleton title={title} />}
      {sources.status === 'error' && (
        <DivesError overline="Erreur" onRetry={sources.retry} hint={DIVE_LOAD_ERROR_HINT} />
      )}
      {sources.status === 'ready' && (
        <ModeForm
          // A new mode (or another dive) is another form: fresh state, its own draft.
          key={draftKey(mode)}
          mode={mode}
          log={sources.log}
          sources={sources.sources}
        />
      )}
    </>
  );
}

interface ModeFormProps {
  mode: DiveFormMode;
  log: LoggedDive[];
  sources: DiveFormSources;
}

function ModeForm({ mode, log, sources }: ModeFormProps) {
  // Read once: the day and the suggestion must not move while the diver types.
  const [now] = useState(() => new Date());
  const today = toDayValue(now);
  const defaults = { today, nextNumber: sources.maxNumber + 1 };

  switch (mode.kind) {
    case 'new': {
      const suggestion = findResumeSuggestion(log, now);
      const props: SharedFormProps = {
        mode,
        log,
        sources,
        number: defaults.nextNumber,
        initialValues: newDiveValues(defaults),
        target: { kind: 'create' },
        today,
        editedId: null,
        cancelHref: '/dives',
      };
      return suggestion ? (
        <SuggestedDiveForm {...props} suggestionId={suggestion.id} />
      ) : (
        <PageDiveForm {...props} prefill={{ kind: 'none' }} />
      );
    }
    case 'duplicate':
      return (
        <SourceLoader id={mode.sourceId}>
          {(source) => (
            <PageDiveForm
              mode={mode}
              log={log}
              sources={sources}
              number={defaults.nextNumber}
              initialValues={duplicateDiveValues(source, defaults)}
              target={{ kind: 'create' }}
              today={today}
              editedId={null}
              cancelHref={`/dives/${source.id}`}
              prefill={{ kind: 'duplicate', source, blankValues: newDiveValues(defaults) }}
            />
          )}
        </SourceLoader>
      );
    case 'edit':
      return (
        <SourceLoader id={mode.diveId}>
          {(dive) => (
            <PageDiveForm
              mode={mode}
              log={log}
              sources={sources}
              number={dive.number}
              initialValues={editDiveValues(dive)}
              target={editTarget(dive)}
              today={today}
              editedId={dive.id}
              cancelHref={`/dives/${dive.id}`}
              prefill={{ kind: 'none' }}
            />
          )}
        </SourceLoader>
      );
  }
}

interface SourceLoaderProps {
  id: string;
  children: (dive: DiveDetailView) => ReactNode;
}

/** The dive to duplicate or edit: loading, not found and error states of the detail. */
function SourceLoader({ id, children }: SourceLoaderProps) {
  const state = useDive(id, DIVER);
  switch (state.status) {
    case 'loading':
      return <DiveFormSkeleton title="Chargement de la plongée" />;
    case 'not-found':
      return <DiveNotFound backHref="/dives" />;
    case 'error':
      return (
        <DivesError
          overline="Erreur"
          message={DIVE_LOAD_ERROR_MESSAGE}
          hint={DIVE_LOAD_ERROR_HINT}
          onRetry={state.retry}
        />
      );
    case 'ready':
      return children(state.dive);
  }
}

interface SharedFormProps {
  mode: DiveFormMode;
  log: LoggedDive[];
  sources: DiveFormSources;
  number: number;
  initialValues: DiveFormValues;
  target: DiveFormTarget;
  today: string;
  /** The edited dive, whose own number is not « taken ». */
  editedId: string | null;
  cancelHref: string;
}

/** A new dive whose suggestion (latest dive, < 48 h) is offered once its detail is loaded. */
function SuggestedDiveForm({ suggestionId, ...props }: SharedFormProps & { suggestionId: string }) {
  const state = useDive(suggestionId, DIVER);
  const prefill: DiveFormPrefill =
    state.status === 'ready' ? { kind: 'suggestion', source: state.dive } : { kind: 'none' };
  return <PageDiveForm {...props} prefill={prefill} />;
}

/** The form with what every mode shares: the diver, the save port, the draft and the redirect. */
function PageDiveForm({
  today,
  editedId,
  log,
  ...props
}: SharedFormProps & Pick<DiveFormProps, 'prefill'>) {
  const navigate = useNavigate();
  const saveDive = useSaveDive(DIVER_LEVEL);
  // Read once per form: the numbers taken by the other dives of the log.
  const [context] = useState(() => ({
    today,
    diverLevel: DIVER.level,
    takenNumbers: takenNumbers(log, editedId),
  }));

  return (
    <DiveForm
      {...props}
      log={log}
      context={context}
      self={SELF}
      canEditEvent={CAN_EDIT_EVENT}
      saveDive={saveDive}
      draftStore={draftStore}
      // The saved dive replaces the form in the history: « Retour » does not reopen it.
      onSaved={(id) => void navigate(`/dives/${id}`, { replace: true })}
    />
  );
}
