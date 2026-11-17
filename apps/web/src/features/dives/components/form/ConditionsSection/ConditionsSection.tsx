import type { Weather } from '@e-deep/shared';
import { useId } from 'react';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from '@/shared/ui/NumberInput';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import {
  CURRENT_STRENGTHS,
  ENTRY_TYPES,
  SEA_STATES,
  TIMES_OF_DAY,
  WEATHERS,
} from '../../../api/divesApi';
import type { DiveForm } from '../../../form/useDiveForm';
import {
  CURRENT_STRENGTH_LABELS,
  ENTRY_TYPE_LABELS,
  SEA_STATE_LABELS,
  TIME_OF_DAY_LABELS,
  WEATHER_LABELS,
} from '../../../lib/labels';
import { choiceOptions, fieldBinder, numberProps, textProps } from '../fieldBinding';
import { FormSection, type FormSectionCollapse } from '../FormSection';
import styles from './ConditionsSection.module.scss';

export interface ConditionsSectionProps {
  form: DiveForm;
  canEditEvent: boolean;
  /** Phones: folded section (accordion). */
  collapse?: FormSectionCollapse | undefined;
  /** Dive centres already entered, offered while typing. */
  diveCenters: readonly string[];
}

const ENTRY_OPTIONS = choiceOptions(ENTRY_TYPES, ENTRY_TYPE_LABELS);
const TIME_OPTIONS = choiceOptions(TIMES_OF_DAY, TIME_OF_DAY_LABELS);
const SEA_OPTIONS = choiceOptions(SEA_STATES, SEA_STATE_LABELS);
const CURRENT_OPTIONS = choiceOptions(CURRENT_STRENGTHS, CURRENT_STRENGTH_LABELS);

/** No weather chosen: the select starts on « — ». */
const NO_WEATHER = '';
const WEATHER_OPTIONS: SelectOption<Weather | typeof NO_WEATHER>[] = [
  { value: NO_WEATHER, label: '—' },
  ...choiceOptions(WEATHERS, WEATHER_LABELS),
];

/** Section 5: the shared event first (entry, moment, centre, weather, sea), then the water. */
export function ConditionsSection({
  form,
  canEditEvent,
  collapse,
  diveCenters,
}: ConditionsSectionProps) {
  const bind = fieldBinder(form, canEditEvent);
  const { values } = form;
  const centersId = useId();

  return (
    <FormSection section="conditions" optional collapse={collapse}>
      <div className={styles.halves}>
        <FormField label="Mise à l’eau" {...bind('entryType')}>
          <SegmentedControl
            variant="field"
            options={ENTRY_OPTIONS}
            value={values.entryType}
            onChange={(entryType) => form.change('entryType', entryType)}
          />
        </FormField>
        <FormField label="Moment" {...bind('timeOfDay')}>
          <SegmentedControl
            variant="field"
            options={TIME_OPTIONS}
            value={values.timeOfDay}
            onChange={(timeOfDay) => form.change('timeOfDay', timeOfDay)}
          />
        </FormField>
      </div>
      <FormField label="Structure" {...bind('diveCenter', 'Club ou centre de plongée')}>
        <TextInput
          {...textProps(form, 'diveCenter')}
          autoComplete="off"
          list={diveCenters.length > 0 ? centersId : undefined}
        />
      </FormField>
      {diveCenters.length > 0 && (
        <datalist id={centersId}>
          {diveCenters.map((center) => (
            <option key={center} value={center} />
          ))}
        </datalist>
      )}
      <div className={styles.weatherRow}>
        <FormField label="Météo" {...bind('weather')}>
          <Select
            variant="field"
            options={WEATHER_OPTIONS}
            value={values.weather ?? NO_WEATHER}
            onChange={(weather) => form.change('weather', weather === NO_WEATHER ? null : weather)}
          />
        </FormField>
        <FormField label="Air" {...bind('airTemperatureC')}>
          <NumberInput
            {...numberProps(form, 'airTemperatureC')}
            decimal
            signed
            unit="°C"
            unitLabel="degrés"
          />
        </FormField>
      </div>
      <FormField label="Mer" {...bind('seaState')}>
        <SegmentedControl
          variant="field"
          options={SEA_OPTIONS}
          value={values.seaState}
          onChange={(seaState) => form.change('seaState', seaState)}
        />
      </FormField>
      <FormField label="Courant" {...bind('currentStrength')}>
        <SegmentedControl
          variant="field"
          options={CURRENT_OPTIONS}
          value={values.currentStrength}
          onChange={(strength) => form.change('currentStrength', strength)}
        />
      </FormField>
      <div className={styles.waterRow}>
        <FormField label="Eau surface" {...bind('surfaceTemperatureC')}>
          <NumberInput
            {...numberProps(form, 'surfaceTemperatureC')}
            decimal
            signed
            unit="°C"
            unitLabel="degrés"
          />
        </FormField>
        <FormField label="Eau fond" {...bind('bottomTemperatureC')}>
          <NumberInput
            {...numberProps(form, 'bottomTemperatureC')}
            decimal
            signed
            unit="°C"
            unitLabel="degrés"
          />
        </FormField>
        <FormField label="Visibilité" {...bind('visibilityM')} className={styles.visibility}>
          <NumberInput
            {...numberProps(form, 'visibilityM')}
            decimal
            placeholder="—"
            unit="m"
            unitLabel="mètres"
          />
        </FormField>
      </div>
    </FormSection>
  );
}
