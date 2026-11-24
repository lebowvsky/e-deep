import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { dashboardKeys } from '@/features/dashboard/api/queryKeys';
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
import type { DiveFormValues } from '@/features/dives/form/model';
import {
  duplicateDiveValues,
  editDiveValues,
  editTarget,
  findResumeSuggestion,
  newDiveValues,
  type DiveFormMode,
} from '@/features/dives/form/prefill';
import type { DiveFormSources } from '@/features/dives/form/sources';
import { toDayValue } from '@/features/dives/form/timeLink';
import { useDiveFormSources } from '@/features/dives/form/useDiveFormSources';
import { useDive } from '@/features/dives/hooks/useDive';
import { useSaveDive } from '@/features/dives/hooks/useSaveDive';
import { DIVE_LOAD_ERROR_HINT, DIVE_LOAD_ERROR_MESSAGE } from '@/features/dives/lib/labels';
import type { DiveDetailView, LoggedDive } from '@/features/dives/types';
import { DiveFormTopBar } from '@/features/dives/components/form/DiveFormTopBar';
import { pageTitle } from '@/shared/config/app';
import type { SiteDraft } from '@/shared/model/site';
import { useCurrentDiver } from '@/shared/session/hooks/useCurrentDiver';
import { useSiteCommands } from '@/shared/sites/hooks/useSiteCommands';
import { useToast } from '@/shared/ui/Toast';

/**
 * V1: every diver creates their own dives, so the shared event of an edited dive is theirs to edit.
 * Club use will check who created the dive.
 */
const CAN_EDIT_EVENT = true;

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

/** Where « Annuler » and ✕ go: the log, or the dive duplicated or edited. */
function exitHref(mode: DiveFormMode): string {
  switch (mode.kind) {
    case 'new':
      return '/dives';
    case 'duplicate':
      return `/dives/${mode.sourceId}`;
    case 'edit':
      return `/dives/${mode.diveId}`;
  }
}

export interface DiveFormPageProps {
  /**
   * Edit mode: the diver may change the shared event (site, date, conditions…). `false` locks those
   * fields. A new or duplicated dive is always the diver's own event.
   */
  canEditEvent?: boolean;
}

/** The phone top bar while the form is not there yet: ✕ always leaves, the number is unknown. */
function PendingTopBar({ mode }: { mode: DiveFormMode }) {
  return <DiveFormTopBar title={titleOf(mode)} number={null} cancelHref={exitHref(mode)} />;
}

/**
 * « Nouvelle plongée », its duplicate and « Modifier la plongée ». Waits for the log (logbook
 * number, sites, divers) and, when needed, for the source dive, then mounts the form once per mode.
 * The phone top bar stays in every state, so that ✕ always leaves; the form brings its own, with
 * the number computed from the date.
 */
export function DiveFormPage({ canEditEvent = CAN_EDIT_EVENT }: DiveFormPageProps) {
  const mode = useDiveFormMode();
  const sources = useDiveFormSources(useCurrentDiver());
  const title = titleOf(mode);

  return (
    <>
      <title>{pageTitle(title)}</title>
      {sources.status !== 'ready' && <PendingTopBar mode={mode} />}
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
          canEditEvent={canEditEvent}
        />
      )}
    </>
  );
}

interface ModeFormProps {
  mode: DiveFormMode;
  log: LoggedDive[];
  sources: DiveFormSources;
  canEditEvent: boolean;
}

/** `?site=:id` (« Nouvelle plongée ici » of a site page): that site, when it is one of mine. */
function useSiteParam(sources: DiveFormSources): DiveFormValues['site'] | null {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('site');
  const site = id === null ? undefined : sources.sites.find((option) => option.id === id);
  return site ? { id: site.id, name: site.name } : null;
}

function ModeForm({ mode, log, sources, canEditEvent }: ModeFormProps) {
  const siteParam = useSiteParam(sources);
  // Read once: the day and the suggestion must not move while the diver types. A log that changes
  // meanwhile (a save written in the cache, a refetch) must not swap the form for another one.
  const [now] = useState(() => new Date());
  // Read once too: the initial values of the form.
  const [initialSite] = useState(siteParam);
  const [suggestionId] = useState(() =>
    mode.kind === 'new' ? (findResumeSuggestion(log, now)?.id ?? null) : null,
  );
  const today = toDayValue(now);
  const common = { mode, log, sources, today, cancelHref: exitHref(mode) };

  switch (mode.kind) {
    case 'new': {
      const props: SharedFormProps = {
        ...common,
        initialValues: initialSite
          ? { ...newDiveValues({ today }), site: initialSite }
          : newDiveValues({ today }),
        target: { kind: 'create' },
        canEditEvent: true,
      };
      return suggestionId === null ? (
        <PageDiveForm {...props} prefill={{ kind: 'none' }} />
      ) : (
        <SuggestedDiveForm {...props} suggestionId={suggestionId} />
      );
    }
    case 'duplicate':
      return (
        <SourceLoader id={mode.sourceId} mode={mode}>
          {(source) => (
            <PageDiveForm
              {...common}
              initialValues={duplicateDiveValues(source, { today })}
              target={{ kind: 'create' }}
              canEditEvent
              prefill={{ kind: 'duplicate', source, blankValues: newDiveValues({ today }) }}
            />
          )}
        </SourceLoader>
      );
    case 'edit':
      return (
        <SourceLoader id={mode.diveId} mode={mode}>
          {(dive) => (
            <PageDiveForm
              {...common}
              initialValues={editDiveValues(dive)}
              target={editTarget(dive)}
              canEditEvent={canEditEvent}
              prefill={{ kind: 'none' }}
            />
          )}
        </SourceLoader>
      );
  }
}

interface SourceLoaderProps {
  id: string;
  mode: DiveFormMode;
  children: (dive: DiveDetailView) => ReactNode;
}

/** The dive to duplicate or edit: loading, not found and error states of the detail. */
function SourceLoader({ id, mode, children }: SourceLoaderProps) {
  const state = useDive(id, useCurrentDiver());
  switch (state.status) {
    case 'loading':
      return (
        <>
          <PendingTopBar mode={mode} />
          <DiveFormSkeleton title="Chargement de la plongée" />
        </>
      );
    case 'not-found':
      return (
        <>
          <PendingTopBar mode={mode} />
          <DiveNotFound backHref="/dives" />
        </>
      );
    case 'error':
      return (
        <>
          <PendingTopBar mode={mode} />
          <DivesError
            overline="Erreur"
            message={DIVE_LOAD_ERROR_MESSAGE}
            hint={DIVE_LOAD_ERROR_HINT}
            onRetry={state.retry}
          />
        </>
      );
    case 'ready':
      return children(state.dive);
  }
}

interface SharedFormProps {
  mode: DiveFormMode;
  log: LoggedDive[];
  sources: DiveFormSources;
  initialValues: DiveFormValues;
  target: DiveFormTarget;
  today: string;
  cancelHref: string;
  /** `false`: the shared event fields are read only. */
  canEditEvent: boolean;
}

/** A new dive whose suggestion (latest dive, < 48 h) is offered once its detail is loaded. */
function SuggestedDiveForm({ suggestionId, ...props }: SharedFormProps & { suggestionId: string }) {
  const state = useDive(suggestionId, useCurrentDiver());
  const prefill: DiveFormPrefill =
    state.status === 'ready' ? { kind: 'suggestion', source: state.dive } : { kind: 'none' };
  return <PageDiveForm {...props} prefill={prefill} />;
}

/**
 * The form with what every mode shares: the diver, the save port, the draft, and once saved the
 * toast and the redirect.
 */
function PageDiveForm({ today, ...props }: SharedFormProps & Pick<DiveFormProps, 'prefill'>) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const saveDive = useSaveDive();
  const { create } = useSiteCommands();
  const diver = useCurrentDiver();
  // Read once per form: the memoised actions of the form depend on them. The diver does not change
  // under a mounted form (another session goes through the login page).
  const [context] = useState(() => ({ today, diverLevel: diver.level.code }));
  const [self] = useState(() => ({
    firstName: diver.firstName,
    lastName: diver.lastName,
    level: diver.level.code,
  }));
  // The diver's own drafts (D41): another account on this device never sees them.
  const [draftStore] = useState(() => createLocalDraftStore(diver.id));
  // Stable: the site section skips the renders caused by the other sections.
  const createSite = useCallback((draft: SiteDraft) => create(draft, 'quick'), [create]);

  return (
    <DiveForm
      {...props}
      context={context}
      self={self}
      saveDive={saveDive}
      draftStore={draftStore}
      onCreateSite={createSite}
      onSaved={(id, number) => {
        // The dashboard sums up the log (stats, last dive, sites): another feature, so marked
        // stale here rather than by the dive write. Not awaited: the dashboard is not the next page.
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        // The number the dive got (D26): another one than shown if the log moved meanwhile.
        notify(`Plongée #${number} enregistrée`);
        // The saved dive replaces the form in the history: « Retour » does not reopen it.
        void navigate(`/dives/${id}`, { replace: true });
      }}
    />
  );
}
