import { useId, useRef } from 'react';
import { formatInterval } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { NumberInput } from '@/shared/ui/NumberInput';
import { Switch } from '@/shared/ui/Switch';
import { TextInput } from '@/shared/ui/TextInput';
import type { DiveFormValues } from '../../../form/model';
import type { DiveForm } from '../../../form/useDiveForm';
import { fieldBinder, fieldId, numberProps, textProps } from '../fieldBinding';
import { FormSection, type FormSectionCollapse } from '../FormSection';
import styles from './RunSection.module.scss';

export interface RunSectionProps {
  form: DiveForm;
  canEditEvent: boolean;
  /** Phones: folded section (accordion). */
  collapse?: FormSectionCollapse | undefined;
  /** Surface interval since the previous dive of the log (minutes), `null` beyond 12 h. */
  proposeSurfaceInterval: (values: DiveFormValues) => number | null;
}

/** Section 2: safety stop, decompression stops, stops done as planned, repetitive dive. */
export function RunSection({
  form,
  canEditEvent,
  collapse,
  proposeSurfaceInterval,
}: RunSectionProps) {
  const bind = fieldBinder(form, canEditEvent);
  const { values } = form;

  const toggleRepetitive = (isRepetitive: boolean) => {
    form.change('repetitive', isRepetitive);
    if (!isRepetitive || values.surfaceInterval.trim() !== '') return;
    const proposed = proposeSurfaceInterval(values);
    if (proposed !== null) form.change('surfaceInterval', formatInterval(proposed));
  };

  return (
    <FormSection section="run" optional collapse={collapse}>
      <div className={styles.rows}>
        <div className={styles.row}>
          <Switch
            id={fieldId('safetyStop')}
            checked={values.safetyStop}
            onCheckedChange={(checked) => form.change('safetyStop', checked)}
            label="Palier de sécurité"
            hint="Fait pendant la remontée"
          />
          {values.safetyStop && (
            <div className={styles.pair}>
              <FormField label="Durée" {...bind('safetyStopDurationMin')}>
                <NumberInput
                  {...numberProps(form, 'safetyStopDurationMin')}
                  unit="min"
                  unitLabel="minutes"
                />
              </FormField>
              <FormField label="Profondeur" {...bind('safetyStopDepthM')}>
                <NumberInput
                  {...numberProps(form, 'safetyStopDepthM')}
                  decimal
                  unit="m"
                  unitLabel="mètres"
                />
              </FormField>
            </div>
          )}
        </div>

        <div className={styles.row}>
          <Switch
            id={fieldId('decompression')}
            checked={values.decompression}
            onCheckedChange={(checked) => form.change('decompression', checked)}
            label="Paliers de décompression"
            hint="Imposés par ton ordinateur ou tes tables"
          />
          {values.decompression && <DecoStops form={form} />}
        </div>

        <div className={styles.row}>
          <Switch
            id={fieldId('stopsOk')}
            checked={values.stopsOk}
            onCheckedChange={(checked) => form.change('stopsOk', checked)}
            label="Paliers respectés"
            hint="Faits comme prévu, sans écart"
          />
        </div>

        <div className={styles.row}>
          <Switch
            id={fieldId('repetitive')}
            checked={values.repetitive}
            onCheckedChange={toggleRepetitive}
            label="Plongée successive"
            hint="Moins de 12 h après la précédente"
          />
          {values.repetitive && (
            <div className={styles.pair}>
              <FormField
                label="Intervalle de surface"
                {...bind('surfaceInterval', 'Au format h:mm.')}
              >
                <TextInput
                  {...textProps(form, 'surfaceInterval')}
                  font="mono"
                  autoComplete="off"
                  placeholder="1:30"
                  unit="h:mm"
                  unitLabel="heures et minutes"
                />
              </FormField>
            </div>
          )}
        </div>
      </div>
    </FormSection>
  );
}

interface DecoStopsProps {
  form: DiveForm;
}

/** One « profondeur · durée » line per decompression stop, and « Ajouter un palier ». */
function DecoStops({ form }: DecoStopsProps) {
  const { decoStops } = form.values;
  const error = form.errors.decoStops;
  const errorId = useId();
  const addRef = useRef<HTMLButtonElement>(null);
  // The message sits under the whole list, not under one field: each stop field points to it.
  const errorProps = error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};

  return (
    <div className={styles.stops}>
      {decoStops.map((stop, index) => (
        <fieldset key={stop.key} className={styles.stop}>
          <legend className={styles.stopLegend}>Palier {index + 1}</legend>
          <div className={styles.stopFields}>
            <FormField label="Profondeur" {...(index === 0 ? { id: fieldId('decoStops') } : {})}>
              <NumberInput
                value={stop.depthM}
                onValueChange={(value) => form.changeDecoStop(stop.key, 'depthM', value)}
                onBlur={() => form.blur('decoStops')}
                decimal
                unit="m"
                unitLabel="mètres"
                {...errorProps}
              />
            </FormField>
            <FormField label="Durée">
              <NumberInput
                value={stop.durationMin}
                onValueChange={(value) => form.changeDecoStop(stop.key, 'durationMin', value)}
                onBlur={() => form.blur('decoStops')}
                unit="min"
                unitLabel="minutes"
                {...errorProps}
              />
            </FormField>
            <IconButton
              icon="close"
              iconSize="sm"
              label={`Retirer le palier ${index + 1}`}
              className={styles.remove}
              onClick={() => {
                form.removeDecoStop(stop.key);
                // The removed button took the focus with it: keep it in the list.
                addRef.current?.focus();
              }}
            />
          </div>
        </fieldset>
      ))}
      {error && (
        <p id={errorId} className={styles.error}>
          <Icon name="alert" size="sm" className={styles.errorIcon} />
          <span>{error}</span>
        </p>
      )}
      <Button
        ref={addRef}
        variant="ghost"
        icon="plus"
        className={styles.add}
        onClick={form.addDecoStop}
        aria-describedby={error ? errorId : undefined}
        {...(decoStops.length === 0 ? { id: fieldId('decoStops') } : {})}
      >
        Ajouter un palier
      </Button>
    </div>
  );
}
