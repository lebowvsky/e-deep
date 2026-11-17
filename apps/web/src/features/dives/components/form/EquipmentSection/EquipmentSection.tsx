import { memo } from 'react';
import { formatMeasure } from '@/shared/lib/format';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from '@/shared/ui/NumberInput';
import { SegmentedControl, type SegmentedOption } from '@/shared/ui/SegmentedControl';
import { consumedBarOf } from '../../../form/derived';
import { AIR_O2_PERCENT, type GasChoice } from '../../../form/model';
import { SUIT_TYPE_LABELS, TANK_MATERIAL_LABELS } from '../../../lib/labels';
import { SUIT_TYPES, TANK_MATERIALS } from '../../../lib/unions';
import {
  choiceOptions,
  fieldBinder,
  numberProps,
  sameSectionProps,
  sectionReads,
  type SectionForm,
} from '../fieldBinding';
import { FormSection, type FormSectionCollapse } from '../FormSection';
import styles from './EquipmentSection.module.scss';

export interface EquipmentSectionProps {
  form: SectionForm;
  canEditEvent: boolean;
  /** Phones: folded section (accordion). */
  collapse?: FormSectionCollapse | undefined;
}

const GAS_OPTIONS: SegmentedOption<GasChoice>[] = [
  { value: 'AIR', label: 'Air' },
  { value: 'NITROX', label: 'Nitrox' },
];

const MATERIAL_OPTIONS = choiceOptions(TANK_MATERIALS, TANK_MATERIAL_LABELS);
const SUIT_OPTIONS = choiceOptions(SUIT_TYPES, SUIT_TYPE_LABELS);

const CONSUMED_HINT = '→ bar consommés calculés à l’enregistrement';

/** Section 4: gas, tank, pressures, suit and weight (the diver's own kit). */
export const EquipmentSection = memo(
  function EquipmentSection({ form, canEditEvent, collapse }: EquipmentSectionProps) {
    const bind = fieldBinder(form, canEditEvent);
    const { values } = form;
    const { change } = form.actions;
    const isAir = values.gas === 'AIR';
    const consumed = consumedBarOf(values);

    return (
      <FormSection section="equipment" optional collapse={collapse}>
        <div className={styles.gasRow}>
          <FormField {...bind('gas')}>
            <SegmentedControl
              variant="field"
              options={GAS_OPTIONS}
              value={values.gas}
              onChange={(gas) => change('gas', gas)}
            />
          </FormField>
          {isAir ? (
            // Air is 21 % by definition: shown, never typed.
            <FormField {...bind('o2Percent')} hint="Air = 21 %" locked>
              <NumberInput
                value={String(AIR_O2_PERCENT)}
                onValueChange={() => {}}
                unit="%"
                unitLabel="pour cent"
              />
            </FormField>
          ) : (
            <FormField {...bind('o2Percent', 'Nitrox : 22 à 40 %')}>
              <NumberInput {...numberProps(form, 'o2Percent')} unit="%" unitLabel="pour cent" />
            </FormField>
          )}
        </div>
        <div className={styles.halves}>
          <FormField {...bind('tankVolumeL')}>
            <NumberInput {...numberProps(form, 'tankVolumeL')} unit="L" unitLabel="litres" />
          </FormField>
          <FormField {...bind('tankMaterial')}>
            <SegmentedControl
              variant="field"
              options={MATERIAL_OPTIONS}
              value={values.tankMaterial}
              onChange={(material) => change('tankMaterial', material)}
            />
          </FormField>
        </div>
        <div className={styles.halves}>
          <FormField {...bind('startPressureBar')}>
            <NumberInput {...numberProps(form, 'startPressureBar')} unit="bar" unitLabel="bars" />
          </FormField>
          <FormField
            {...bind(
              'endPressureBar',
              consumed === null ? CONSUMED_HINT : `→ ${formatMeasure(consumed)} bar consommés`,
            )}
          >
            <NumberInput {...numberProps(form, 'endPressureBar')} unit="bar" unitLabel="bars" />
          </FormField>
        </div>
        <div className={styles.suitRow}>
          <FormField {...bind('suitThicknessMm')}>
            <NumberInput
              {...numberProps(form, 'suitThicknessMm')}
              decimal
              unit="mm"
              unitLabel="millimètres"
            />
          </FormField>
          <FormField {...bind('suitType')} label="Type" className={styles.suitType}>
            <SegmentedControl
              variant="field"
              options={SUIT_OPTIONS}
              value={values.suitType}
              onChange={(suitType) => change('suitType', suitType)}
            />
          </FormField>
          <FormField {...bind('weightKg')}>
            <NumberInput {...numberProps(form, 'weightKg')} decimal unit="kg" unitLabel="kilos" />
          </FormField>
        </div>
      </FormSection>
    );
  },
  sameSectionProps<EquipmentSectionProps>(sectionReads('equipment')),
);
