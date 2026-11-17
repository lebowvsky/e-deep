import { formatDiveCount } from '@/shared/lib/format';
import { isSameText } from '@/shared/lib/textMatch';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { DateInput } from '@/shared/ui/DateInput';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from '@/shared/ui/NumberInput';
import { TimeInput } from '@/shared/ui/TimeInput';
import type { DiveFormSiteOption } from '../../../form/sources';
import type { DiveForm } from '../../../form/useDiveForm';
import { fieldBinder, numberProps, textProps } from '../fieldBinding';
import { FormSection } from '../FormSection';
import styles from './EssentialSection.module.scss';

export interface EssentialSectionProps {
  form: DiveForm;
  canEditEvent: boolean;
  /** « Mes sites », most dived first. */
  sites: readonly DiveFormSiteOption[];
}

/** Section 1, the only required one: site, number, date, times, duration and depth. */
export function EssentialSection({ form, canEditEvent, sites }: EssentialSectionProps) {
  const bind = fieldBinder(form, canEditEvent);
  const { site } = form.values;
  const options: ComboboxOption[] = sites.map((option) => ({
    id: option.id,
    label: option.name,
    description: option.place,
    meta: formatDiveCount(option.diveCount),
  }));
  const chosenPlace = site.id === null ? null : sites.find(({ id }) => id === site.id)?.place;

  // Typing the exact name of one of my sites picks it; any other text is a new site.
  const typeSite = (name: string) => {
    const known = sites.find((option) => isSameText(option.name, name));
    form.change('site', known ? { id: known.id, name } : { id: null, name });
  };

  return (
    <FormSection
      section="essential"
      aside={
        <span>
          <span className={styles.star} aria-hidden="true">
            *
          </span>{' '}
          obligatoire
        </span>
      }
    >
      <div className={styles.siteRow}>
        <FormField label="Site" {...bind('site', 'Tes sites, ou un nouveau site créé à la volée.')}>
          <Combobox
            options={options}
            inputValue={site.name}
            onInputChange={typeSite}
            onSelect={(option) => form.change('site', { id: option.id, name: option.label })}
            onBlur={() => form.blur('site')}
            create={{
              label: (query) => `Créer le site « ${query} »`,
              description: 'Nom, région et position à préciser ensuite',
              onCreate: (query) => form.change('site', { id: null, name: query.trim() }),
            }}
            groupLabel="Mes sites"
            icon="pin"
            optionIcon="pin"
            placeholder="Rechercher un site…"
            end={chosenPlace && <span className={styles.place}>{chosenPlace}</span>}
          />
        </FormField>
        <FormField label="N° de plongée" {...bind('number', 'Suit ton carnet.')}>
          <NumberInput {...numberProps(form, 'number')} unit="#" />
        </FormField>
      </div>
      <div className={styles.timeRow}>
        <FormField label="Date" {...bind('date')} className={styles.date}>
          <DateInput {...textProps(form, 'date')} />
        </FormField>
        <FormField label="Immersion" {...bind('entryTime')}>
          <TimeInput {...textProps(form, 'entryTime')} />
        </FormField>
        <FormField label="Sortie" {...bind('exitTime')}>
          <TimeInput {...textProps(form, 'exitTime')} />
        </FormField>
      </div>
      <div className={styles.measureRow}>
        <FormField
          label="Durée"
          {...bind('durationMin', 'Calculée depuis les heures — modifiable.')}
        >
          <NumberInput
            {...numberProps(form, 'durationMin')}
            icon="link"
            unit="min"
            unitLabel="minutes"
          />
        </FormField>
        <FormField label="Profondeur max" {...bind('maxDepthM')}>
          <NumberInput {...numberProps(form, 'maxDepthM')} decimal unit="m" unitLabel="mètres" />
        </FormField>
      </div>
    </FormSection>
  );
}
