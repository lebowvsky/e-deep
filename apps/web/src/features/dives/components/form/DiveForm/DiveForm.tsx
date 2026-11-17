import { useId, useRef, useState, type FormEvent } from 'react';
import { useScrollSpy } from '@/shared/hooks/useScrollSpy';
import { useSubmitShortcut } from '@/shared/hooks/useSubmitShortcut';
import { Icon } from '@/shared/ui/Icon';
import type { SaveDive } from '../../../api/saveDive';
import type { DiveFormTarget } from '../../../form/convert';
import { divePreview, sectionStatus } from '../../../form/derived';
import type { DraftStore } from '../../../form/draftStore';
import { DIVE_FORM_SECTIONS, type DiveFormValues } from '../../../form/model';
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

/**
 * The dive form (« Nouvelle plongée », duplicate, « Modifier »): header, banners, the six sections
 * and the sticky right column. Mount it once its initial values are known, with a `key` per mode.
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

  const isEdit = mode.kind === 'edit';
  const { submitStatus } = form;
  const preview = divePreview(form.values, sources.sites);
  const sections = DIVE_FORM_SECTIONS.map((section) => ({
    section,
    status: sectionStatus(section, form.values),
  }));
  const activeSection = DIVE_FORM_SECTIONS.find((section) => sectionId(section) === activeId);

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
    if (outcome.status === 'saved') onSaved(outcome.id);
    if (outcome.status === 'invalid') {
      const [first] = outcome.fields;
      if (first !== undefined) document.getElementById(fieldId(first))?.focus();
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

  const actions = (layout: 'column' | 'row') => (
    <DiveFormActions
      layout={layout}
      submitLabel={isEdit ? 'Enregistrer les modifications' : 'Enregistrer la plongée'}
      isBusy={submitStatus.status === 'submitting'}
      cancelHref={cancelHref}
    />
  );

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
          {submitStatus.status === 'invalid' && <ErrorSummary fields={submitStatus.fields} />}
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
            proposeSurfaceInterval={intervalSincePreviousDive}
          />
          <PalanqueeSection
            form={form}
            canEditEvent={canEditEvent}
            self={self}
            divers={sources.divers}
            frequentDivers={sources.frequentDivers}
          />
          <EquipmentSection form={form} canEditEvent={canEditEvent} />
          <ConditionsSection
            form={form}
            canEditEvent={canEditEvent}
            diveCenters={sources.diveCenters}
          />
          <NotesSection form={form} canEditEvent={canEditEvent} species={sources.species} />
          {actions('row')}
        </div>
        <FormAside
          preview={preview}
          sections={sections}
          activeSection={activeSection}
          draftSavedAt={form.draft.savedAt}
          actions={actions('column')}
        />
      </form>
    </div>
  );
}
