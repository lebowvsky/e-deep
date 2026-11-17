import { formatMeasure } from '@/shared/lib/format';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from '@/shared/ui/NumberInput';
import { SegmentedControl, type SegmentedOption } from '@/shared/ui/SegmentedControl';
import { SUIT_TYPES, TANK_MATERIALS } from '../../../api/divesApi';
import { consumedBarOf } from '../../../form/derived';
import { AIR_O2_PERCENT, type GasChoice } from '../../../form/model';
import type { DiveForm } from '../../../form/useDiveForm';
import { SUIT_TYPE_LABELS, TANK_MATERIAL_LABELS } from '../../../lib/labels';
import { choiceOptions, fieldBinder, numberProps } from '../fieldBinding';
import { FormSection, type FormSectionCollapse } from '../FormSection';
import styles from './EquipmentSection.module.scss';

export interface EquipmentSectionProps {
  form: DiveForm;
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
export function EquipmentSection({ form, canEditEvent, collapse }: EquipmentSectionProps) {
  const bind = fieldBinder(form, canEditEvent);
  const { values } = form;
  const isAir = values.gas === 'AIR';
  const consumed = consumedBarOf(values);

  return (
    <FormSection section="equipment" optional collapse={collapse}>
      <div className={styles.gasRow}>
        <FormField label="Gaz" {...bind('gas')}>
          <SegmentedControl
            variant="field"
            options={GAS_OPTIONS}
            value={values.gas}
            onChange={(gas) => form.change('gas', gas)}
          />
        </FormField>
        {isAir ? (
          // Air is 21 % by definition: shown, never typed.
          <FormField label="% O₂" {...bind('o2Percent')} hint="Air = 21 %" locked>
            <NumberInput
              value={String(AIR_O2_PERCENT)}
              onValueChange={() => {}}
              unit="%"
              unitLabel="pour cent"
            />
          </FormField>
        ) : (
          <FormField label="% O₂" {...bind('o2Percent', 'Nitrox : 22 à 40 %')}>
            <NumberInput {...numberProps(form, 'o2Percent')} unit="%" unitLabel="pour cent" />
          </FormField>
        )}
      </div>
      <div className={styles.halves}>
        <FormField label="Bloc" {...bind('tankVolumeL')}>
          <NumberInput {...numberProps(form, 'tankVolumeL')} unit="L" unitLabel="litres" />
        </FormField>
        <FormField label="Matériau" {...bind('tankMaterial')}>
          <SegmentedControl
            variant="field"
            options={MATERIAL_OPTIONS}
            value={values.tankMaterial}
            onChange={(material) => form.change('tankMaterial', material)}
          />
        </FormField>
      </div>
      <div className={styles.halves}>
        <FormField label="Pression début" {...bind('startPressureBar')}>
          <NumberInput {...numberProps(form, 'startPressureBar')} unit="bar" unitLabel="bars" />
        </FormField>
        <FormField
          label="Pression fin"
          {...bind(
            'endPressureBar',
            consumed === null ? CONSUMED_HINT : `→ ${formatMeasure(consumed)} bar consommés`,
          )}
        >
          <NumberInput {...numberProps(form, 'endPressureBar')} unit="bar" unitLabel="bars" />
        </FormField>
      </div>
      <div className={styles.suitRow}>
        <FormField label="Combinaison" {...bind('suitThicknessMm')}>
          <NumberInput
            {...numberProps(form, 'suitThicknessMm')}
            decimal
            unit="mm"
            unitLabel="millimètres"
          />
        </FormField>
        <FormField label="Type" {...bind('suitType')} className={styles.suitType}>
          <SegmentedControl
            variant="field"
            options={SUIT_OPTIONS}
            value={values.suitType}
            onChange={(suitType) => form.change('suitType', suitType)}
          />
        </FormField>
        <FormField label="Lest" {...bind('weightKg')}>
          <NumberInput {...numberProps(form, 'weightKg')} decimal unit="kg" unitLabel="kilos" />
        </FormField>
      </div>
    </FormSection>
  );
}
