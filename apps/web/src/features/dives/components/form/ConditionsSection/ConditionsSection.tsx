import type { Weather } from '@e-deep/shared';
import { memo, useId } from 'react';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from '@/shared/ui/NumberInput';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import {
  CURRENT_STRENGTH_LABELS,
  ENTRY_TYPE_LABELS,
  SEA_STATE_LABELS,
  TIME_OF_DAY_LABELS,
  WEATHER_LABELS,
} from '../../../lib/labels';
import {
  CURRENT_STRENGTHS,
  ENTRY_TYPES,
  SEA_STATES,
  TIMES_OF_DAY,
  WEATHERS,
} from '../../../lib/unions';
import {
  choiceOptions,
  fieldBinder,
  numberProps,
  sameSectionProps,
  sectionReads,
  textProps,
  type SectionForm,
} from '../fieldBinding';
import { FormSection, type FormSectionCollapse } from '../FormSection';
import styles from './ConditionsSection.module.scss';

export interface ConditionsSectionProps {
  form: SectionForm;
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
export const ConditionsSection = memo(
  function ConditionsSection({
    form,
    canEditEvent,
    collapse,
    diveCenters,
  }: ConditionsSectionProps) {
    const bind = fieldBinder(form, canEditEvent);
    const { values } = form;
    const { change } = form.actions;
    const centersId = useId();

    return (
      <FormSection section="conditions" optional collapse={collapse}>
        <div className={styles.halves}>
          <FormField {...bind('entryType')}>
            <SegmentedControl
              variant="field"
              options={ENTRY_OPTIONS}
              value={values.entryType}
              onChange={(entryType) => change('entryType', entryType)}
            />
          </FormField>
          <FormField {...bind('timeOfDay')}>
            <SegmentedControl
              variant="field"
              options={TIME_OPTIONS}
              value={values.timeOfDay}
              onChange={(timeOfDay) => change('timeOfDay', timeOfDay)}
            />
          </FormField>
        </div>
        <FormField {...bind('diveCenter', 'Club ou centre de plongée')}>
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
          <FormField {...bind('weather')}>
            <Select
              variant="field"
              options={WEATHER_OPTIONS}
              value={values.weather ?? NO_WEATHER}
              onChange={(weather) => change('weather', weather === NO_WEATHER ? null : weather)}
            />
          </FormField>
          <FormField {...bind('airTemperatureC')}>
            <NumberInput
              {...numberProps(form, 'airTemperatureC')}
              decimal
              signed
              unit="°C"
              unitLabel="degrés"
            />
          </FormField>
        </div>
        <FormField {...bind('seaState')}>
          <SegmentedControl
            variant="field"
            options={SEA_OPTIONS}
            value={values.seaState}
            onChange={(seaState) => change('seaState', seaState)}
          />
        </FormField>
        <FormField {...bind('currentStrength')}>
          <SegmentedControl
            variant="field"
            options={CURRENT_OPTIONS}
            value={values.currentStrength}
            onChange={(strength) => change('currentStrength', strength)}
          />
        </FormField>
        <div className={styles.waterRow}>
          <FormField {...bind('surfaceTemperatureC')}>
            <NumberInput
              {...numberProps(form, 'surfaceTemperatureC')}
              decimal
              signed
              unit="°C"
              unitLabel="degrés"
            />
          </FormField>
          <FormField {...bind('bottomTemperatureC')}>
            <NumberInput
              {...numberProps(form, 'bottomTemperatureC')}
              decimal
              signed
              unit="°C"
              unitLabel="degrés"
            />
          </FormField>
          <FormField {...bind('visibilityM')} className={styles.visibility}>
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
  },
  sameSectionProps<ConditionsSectionProps>(sectionReads('conditions')),
);
