import { memo, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatDiveCount } from '@/shared/lib/format';
import { isSameText } from '@/shared/lib/textMatch';
import type { SiteDraft } from '@/shared/model/site';
import { searchSites } from '@/shared/sites/lib/searchSites';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { DateInput } from '@/shared/ui/DateInput';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from '@/shared/ui/NumberInput';
import { TimeInput } from '@/shared/ui/TimeInput';
import type { DiveFormSiteOption } from '../../../form/sources';
import {
  fieldBinder,
  fieldId,
  numberProps,
  sameSectionProps,
  sectionReads,
  textProps,
  type SectionForm,
} from '../fieldBinding';
import { FormSection } from '../FormSection';
import { QuickCreateSitePanel } from '../QuickCreateSitePanel';
import styles from './EssentialSection.module.scss';

export interface EssentialSectionProps {
  form: SectionForm;
  canEditEvent: boolean;
  /** « Mes sites », most dived first. */
  sites: readonly DiveFormSiteOption[];
  /** Regions of « Mes sites », and the one of the latest dive: choices of a new site. */
  regions: readonly string[];
  lastRegion: string | null;
  /** Logbook number the dive will have (D26): shown, never typed. */
  number: number;
  /** Quick creation (`createdVia: 'quick'`): the site created, to select. Keep it stable. */
  onCreateSite: (draft: SiteDraft) => Promise<{ id: string; name: string }>;
}

/** A site in the combobox: what the tolerant search reads, besides the option. */
interface SiteComboboxOption extends ComboboxOption {
  name: string;
  diveCount: number;
}

/** Tolerant search of the sites (accents, articles, typos), best first. */
const searchSiteOptions = (options: readonly SiteComboboxOption[], query: string) =>
  searchSites(options, query);

/** Focus on a field of the form by its id (the summary links use the same ids). */
const focusField = (field: 'site' | 'date') => document.getElementById(fieldId(field))?.focus();

const SITE_HINT = 'Tes sites, ou un nouveau site créé à la volée.';
/** A name that is none of « Mes sites »: saving creates the site, say it before. */
const NEW_SITE_HINT = 'Nouveau site : il sera créé à l’enregistrement.';
const NUMBER_HINT = 'Calculé selon la date';

/** Section 1, the only required one: site, number, date, times, duration and depth. */
export const EssentialSection = memo(
  function EssentialSection({
    form,
    canEditEvent,
    sites,
    regions,
    lastRegion,
    number,
    onCreateSite,
  }: EssentialSectionProps) {
    const bind = fieldBinder(form, canEditEvent);
    const { site } = form.values;
    const { change, blur } = form.actions;
    // The name typed when « Créer le site » was chosen; `null` while the panel is closed.
    const [quickCreateName, setQuickCreateName] = useState<string | null>(null);
    // Each opening is a new panel: its fields start from the name typed.
    const [quickCreateKey, setQuickCreateKey] = useState(0);
    const options: SiteComboboxOption[] = useMemo(
      () =>
        sites.map((option) => ({
          id: option.id,
          label: option.name,
          name: option.name,
          diveCount: option.diveCount,
          description: option.place ?? undefined,
          meta: formatDiveCount(option.diveCount),
        })),
      [sites],
    );
    const chosen = site.id === null ? undefined : sites.find(({ id }) => id === site.id);
    // Typed by name, or created on this device: the API creates it when the dive is saved.
    const isNewSite = site.name.trim() !== '' && (site.id === null || chosen?.isSaved === false);

    const openQuickCreate = (query: string) => {
      setQuickCreateKey((key) => key + 1);
      setQuickCreateName(query.trim());
    };

    /** Picks `chosenSite`, closes the panel and moves on to the date, the next field. */
    const selectAndContinue = (chosenSite: { id: string; name: string }) => {
      // Closed first: the bottom sheet gives the focus back to the site field as it unmounts.
      flushSync(() => {
        change('site', { id: chosenSite.id, name: chosenSite.name });
        setQuickCreateName(null);
      });
      focusField('date');
    };

    const cancelQuickCreate = () => {
      flushSync(() => setQuickCreateName(null));
      focusField('site');
    };

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
              filter={searchSiteOptions}
              create={{
                label: (query) => `Créer le site « ${query} »`,
                description: 'Nom, région et position à préciser ensuite',
                onCreate: openQuickCreate,
              }}
              groupLabel="Mes sites"
              icon="pin"
              optionIcon="pin"
              placeholder="Rechercher un site…"
              end={chosen?.place && <span className={styles.place}>{chosen.place}</span>}
            />
          </FormField>
          {/* D26: the number is the rank of the dive by date, computed and never stored. */}
          <FormField label="N° de plongée" hint={NUMBER_HINT} locked>
            <NumberInput value={String(number)} onValueChange={() => {}} unit="#" />
          </FormField>
        </div>
        {quickCreateName !== null && (
          <QuickCreateSitePanel
            key={quickCreateKey}
            initialName={quickCreateName}
            sites={sites}
            regions={regions}
            lastRegion={lastRegion}
            onCreate={async (draft) => selectAndContinue(await onCreateSite(draft))}
            onUseExisting={selectAndContinue}
            onCancel={cancelQuickCreate}
          />
        )}
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
