import { useId, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { breakpoint } from '@/design/tokens';
import { useLeaveConfirmation } from '@/shared/hooks/useLeaveConfirmation';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useScrollSpy } from '@/shared/hooks/useScrollSpy';
import { useSubmitShortcut } from '@/shared/hooks/useSubmitShortcut';
import { scrollToAndFocus } from '@/shared/lib/focus';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Icon } from '@/shared/ui/Icon';
import type { SaveDive } from '../../../api/saveDive';
import type { DiveFormTarget } from '../../../form/convert';
import { divePreview, sectionStatus, sectionSummary } from '../../../form/derived';
import type { DraftStore } from '../../../form/draftStore';
import {
  DIVE_FORM_SECTIONS,
  FIELD_SECTIONS,
  type DiveFormField,
  type DiveFormSection,
  type DiveFormValues,
} from '../../../form/model';
import type { DiveFormMode } from '../../../form/prefill';
import { proposeSurfaceInterval, type DiveFormSources } from '../../../form/sources';
import { deviceUtcOffsetMinutes, toLocalIso } from '../../../form/timeLink';
import { useDiveForm } from '../../../form/useDiveForm';
import type { ValidationContext } from '../../../form/validation';
import type { DiveDetailView, LoggedDive } from '../../../types';
import { ConditionsSection } from '../ConditionsSection';
import { DiveFormActions } from '../DiveFormActions';
import { DiveFormHeader } from '../DiveFormHeader';
import { DraftBanner } from '../DraftBanner';
import { EquipmentSection } from '../EquipmentSection';
import { ErrorSummary } from '../ErrorSummary';
import { EssentialSection } from '../EssentialSection';
import { fieldId, sectionId } from '../fieldBinding';
import { FormAside } from '../FormAside';
import type { FormSectionCollapse } from '../FormSection';
import { NotesSection } from '../NotesSection';
import { PalanqueeSection, type PalanqueeSelf } from '../PalanqueeSection';
import { PrefillBanner } from '../PrefillBanner';
import { RunSection } from '../RunSection';
import styles from './DiveForm.module.scss';

/** What the form offers to take from another dive. */
export type DiveFormPrefill =
  | { kind: 'none' }
  /** New dive, the latest one is less than 48 h old: « Reprendre » copies its team, kit, conditions. */
  | { kind: 'suggestion'; source: DiveDetailView }
  /** Duplicate of `source`: « Repartir de zéro » goes back to `blankValues`. */
  | { kind: 'duplicate'; source: DiveDetailView; blankValues: DiveFormValues };

export interface DiveFormProps {
  mode: DiveFormMode;
  /** Logbook number in the header: the next one, or the edited dive's. */
  number: number;
  initialValues: DiveFormValues;
  target: DiveFormTarget;
  context: ValidationContext;
  sources: DiveFormSources;
  /** The whole log: surface interval since the previous dive. */
  log: readonly LoggedDive[];
  self: PalanqueeSelf;
  prefill: DiveFormPrefill;
  /** `false` (future club use): the shared event fields are read only. */
  canEditEvent: boolean;
  saveDive: SaveDive;
  draftStore: DraftStore;
  /** Where « Annuler » goes. */
  cancelHref: string;
  /** The dive was saved under `id`. */
  onSaved: (id: string) => void;
}

const SECTION_IDS = DIVE_FORM_SECTIONS.map(sectionId);

/** Same bound as `until($bp-tablet)` in SCSS. */
const PHONE = `(max-width: ${breakpoint.tablet - 1}px)`;

/** `open` with `sections` added; the same set when none is new (no re-render). */
function withSections(
  open: ReadonlySet<DiveFormSection>,
  sections: readonly DiveFormSection[],
): ReadonlySet<DiveFormSection> {
  return sections.every((section) => open.has(section)) ? open : new Set([...open, ...sections]);
}

/**
 * The dive form (« Nouvelle plongée », duplicate, « Modifier »): header, banners, the six sections,
 * and the sticky right column from 1280px or the sticky bottom bar below; on phones, sections 2 to 6
 * fold. Asks before leaving with unsaved changes. Mount it once its initial values are known, with
 * a `key` per mode.
 */
export function DiveForm({
  mode,
  number,
  initialValues,
  target,
  context,
  sources,
  log,
  self,
  prefill,
  canEditEvent,
  saveDive,
  draftStore,
  cancelHref,
  onSaved,
}: DiveFormProps) {
  const form = useDiveForm({ mode, initialValues, target, context, saveDive, draftStore });
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const [isPrefillDismissed, setPrefillDismissed] = useState(false);
  const activeId = useScrollSpy(SECTION_IDS);
  useSubmitShortcut(() => formRef.current?.requestSubmit());
  // The accordion changes the DOM (header button, hidden fields), not only the layout: SCSS alone
  // cannot do it. Sections 2 to 6 fold on phones only; the open ones stay open across resizes.
  const isPhone = useMediaQuery(PHONE);
  const [openSections, setOpenSections] = useState<ReadonlySet<DiveFormSection>>(() => new Set());
  const { submitStatus } = form;
  const leave = useLeaveConfirmation(form.isDirty && submitStatus.status !== 'saved');

  const isEdit = mode.kind === 'edit';
  const preview = divePreview(form.values, sources.sites);
  const sections = DIVE_FORM_SECTIONS.map((section) => ({
    section,
    status: sectionStatus(section, form.values),
  }));
  const activeSection = DIVE_FORM_SECTIONS.find((section) => sectionId(section) === activeId);

  const collapseOf = (section: DiveFormSection): FormSectionCollapse | undefined =>
    isPhone
      ? {
          open: openSections.has(section),
          onOpenChange: (open) =>
            setOpenSections((current) => {
              const next = new Set(current);
              if (open) next.add(section);
              else next.delete(section);
              return next;
            }),
          summary: sectionSummary(section, form.values),
          status: sectionStatus(section, form.values),
        }
      : undefined;

  /**
   * Opens the sections of `fields` — committed at once, so that their controls are no longer
   * hidden — then scrolls to the first field and focuses it.
   */
  const revealFields = (fields: readonly DiveFormField[]) => {
    const [first] = fields;
    if (first === undefined) return;
    flushSync(() =>
      setOpenSections((current) =>
        withSections(
          current,
          fields.map((field) => FIELD_SECTIONS[field]),
        ),
      ),
    );
    const control = document.getElementById(fieldId(first));
    if (control) scrollToAndFocus(control);
  };

  const intervalSincePreviousDive = (values: DiveFormValues): number | null => {
    const offset =
      target.kind === 'update'
        ? target.utcOffsetMinutes
        : deviceUtcOffsetMinutes(values.date, values.entryTime);
    const startedAt = offset === null ? null : toLocalIso(values.date, values.entryTime, offset);
    if (startedAt === null) return null;
    return proposeSurfaceInterval(log, startedAt, target.kind === 'update' ? target.diveId : null);
  };

  const save = async () => {
    const outcome = await form.submit();
    switch (outcome.status) {
      case 'saved':
        // The redirect runs before the next render: the blocker must not stop it.
        leave.release();
        onSaved(outcome.id);
        break;
      case 'invalid':
        revealFields(outcome.fields);
        break;
      case 'failed':
        // Unexpected (network, bug): the alert tells the diver, the error goes to the browser.
        reportError(outcome.error);
        break;
      case 'busy':
        break;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  const handlePrefillAction = () => {
    if (prefill.kind === 'suggestion') form.resume(prefill.source);
    if (prefill.kind === 'duplicate') form.reset(prefill.blankValues);
    setPrefillDismissed(true);
  };

  const actions = (layout: 'column' | 'bar') => (
    <DiveFormActions
      layout={layout}
      submitLabel={isEdit ? 'Enregistrer les modifications' : 'Enregistrer la plongée'}
      isBusy={submitStatus.status === 'submitting'}
      cancelHref={cancelHref}
      draftSavedAt={form.draft.savedAt}
    />
  );

  const { blocker } = leave;

  return (
    <div className={styles.page}>
      <DiveFormHeader
        isEdit={isEdit}
        number={number}
        titleId={titleId}
        diveHref={mode.kind === 'edit' ? `/dives/${mode.diveId}` : null}
      />
      <form
        ref={formRef}
        className={styles.layout}
        aria-labelledby={titleId}
        noValidate
        onSubmit={handleSubmit}
      >
        <div className={styles.main}>
          {submitStatus.status === 'invalid' && (
            <ErrorSummary
              fields={submitStatus.fields}
              onSelect={(field) => revealFields([field])}
            />
          )}
          {submitStatus.status === 'failed' && (
            <p role="alert" className={styles.failure}>
              <Icon name="alert" size="md" className={styles.failureIcon} />
              L’enregistrement n’a pas abouti. Ta saisie est conservée : réessaie dans un instant.
            </p>
          )}
          {prefill.kind !== 'none' && !isPrefillDismissed && (
            <PrefillBanner
              variant={prefill.kind}
              number={prefill.source.number}
              siteName={prefill.source.site.name}
              onAction={handlePrefillAction}
            />
          )}
          {form.draft.isRestored && <DraftBanner onDiscard={form.discardDraft} />}
          <EssentialSection form={form} canEditEvent={canEditEvent} sites={sources.sites} />
          <RunSection
            form={form}
            canEditEvent={canEditEvent}
            collapse={collapseOf('run')}
            proposeSurfaceInterval={intervalSincePreviousDive}
          />
          <PalanqueeSection
            form={form}
            canEditEvent={canEditEvent}
            collapse={collapseOf('team')}
            self={self}
            divers={sources.divers}
            frequentDivers={sources.frequentDivers}
          />
          <EquipmentSection
            form={form}
            canEditEvent={canEditEvent}
            collapse={collapseOf('equipment')}
          />
          <ConditionsSection
            form={form}
            canEditEvent={canEditEvent}
            collapse={collapseOf('conditions')}
            diveCenters={sources.diveCenters}
          />
          <NotesSection
            form={form}
            canEditEvent={canEditEvent}
            collapse={collapseOf('notes')}
            species={sources.species}
          />
          {actions('bar')}
        </div>
        <FormAside
          preview={preview}
          sections={sections}
          activeSection={activeSection}
          actions={actions('column')}
        />
      </form>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Quitter sans enregistrer ?"
        description="Ton brouillon reste disponible sur cet appareil."
        cancelLabel="Rester"
        confirmLabel="Quitter"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
