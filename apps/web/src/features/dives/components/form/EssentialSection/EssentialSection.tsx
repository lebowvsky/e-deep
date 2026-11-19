import { memo, useMemo } from 'react';
import { formatDiveCount } from '@/shared/lib/format';
import { isSameText } from '@/shared/lib/textMatch';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { DateInput } from '@/shared/ui/DateInput';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from '@/shared/ui/NumberInput';
import { TimeInput } from '@/shared/ui/TimeInput';
import type { DiveFormSiteOption } from '../../../form/sources';
import {
  fieldBinder,
  numberProps,
  sameSectionProps,
  sectionReads,
  textProps,
  type SectionForm,
} from '../fieldBinding';
import { FormSection } from '../FormSection';
import styles from './EssentialSection.module.scss';

export interface EssentialSectionProps {
  form: SectionForm;
  canEditEvent: boolean;
  /** « Mes sites », most dived first. */
  sites: readonly DiveFormSiteOption[];
  /** Logbook number the dive will have (D26): shown, never typed. */
  number: number;
}

const SITE_HINT = 'Tes sites, ou un nouveau site créé à la volée.';
/** A name that is none of « Mes sites »: saving creates the site, say it before. */
const NEW_SITE_HINT = 'Nouveau site : il sera créé à l’enregistrement.';
const NUMBER_HINT = 'Calculé selon la date';

/** Section 1, the only required one: site, number, date, times, duration and depth. */
export const EssentialSection = memo(
  function EssentialSection({ form, canEditEvent, sites, number }: EssentialSectionProps) {
    const bind = fieldBinder(form, canEditEvent);
    const { site } = form.values;
    const { change, blur } = form.actions;
    const options: ComboboxOption[] = useMemo(
      () =>
        sites.map((option) => ({
          id: option.id,
          label: option.name,
          description: option.place ?? undefined,
          meta: formatDiveCount(option.diveCount),
        })),
      [sites],
    );
    const chosenPlace = site.id === null ? null : sites.find(({ id }) => id === site.id)?.place;
    const isNewSite = site.id === null && site.name.trim() !== '';

    // Typing the exact name of one of my sites picks it; any other text is a new site.
    const typeSite = (name: string) => {
      const known = sites.find((option) => isSameText(option.name, name));
      change('site', known ? { id: known.id, name } : { id: null, name });
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
          <FormField {...bind('site', isNewSite ? NEW_SITE_HINT : SITE_HINT)}>
            <Combobox
              options={options}
              inputValue={site.name}
              onInputChange={typeSite}
              onSelect={(option) => change('site', { id: option.id, name: option.label })}
              onBlur={() => blur('site')}
              create={{
                label: (query) => `Créer le site « ${query} »`,
                description: 'Nom, région et position à préciser ensuite',
                onCreate: (query) => change('site', { id: null, name: query.trim() }),
              }}
              groupLabel="Mes sites"
              icon="pin"
              optionIcon="pin"
              placeholder="Rechercher un site…"
              end={chosenPlace && <span className={styles.place}>{chosenPlace}</span>}
            />
          </FormField>
          {/* D26: the number is the rank of the dive by date, computed and never stored. */}
          <FormField label="N° de plongée" hint={NUMBER_HINT} locked>
            <NumberInput value={String(number)} onValueChange={() => {}} unit="#" />
          </FormField>
        </div>
        <div className={styles.timeRow}>
          <FormField {...bind('date')} className={styles.date}>
            <DateInput {...textProps(form, 'date')} />
          </FormField>
          <FormField {...bind('entryTime')}>
            <TimeInput {...textProps(form, 'entryTime')} />
          </FormField>
          <FormField {...bind('exitTime')}>
            <TimeInput {...textProps(form, 'exitTime')} />
          </FormField>
        </div>
        <div className={styles.measureRow}>
          <FormField {...bind('durationMin', 'Calculée depuis les heures — modifiable.')}>
            <NumberInput
              {...numberProps(form, 'durationMin')}
              icon="link"
              unit="min"
              unitLabel="minutes"
            />
          </FormField>
          <FormField {...bind('maxDepthM')}>
            <NumberInput {...numberProps(form, 'maxDepthM')} decimal unit="m" unitLabel="mètres" />
          </FormField>
        </div>
      </FormSection>
    );
  },
  sameSectionProps<EssentialSectionProps>(sectionReads('essential')),
);
