import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { breakpoint } from '@/design/tokens';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { formatDiveCount } from '@/shared/lib/format';
import type { SiteDraft, SiteType } from '@/shared/model/site';
import { SITE_TYPE_LABELS } from '@/shared/sites/lib/labels';
import { searchSites } from '@/shared/sites/lib/searchSites';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { Sheet } from '@/shared/ui/Sheet';
import { TextInput } from '@/shared/ui/TextInput';
import type { DiveFormSiteOption } from '../../../form/sources';
import styles from './QuickCreateSitePanel.module.scss';

export interface QuickCreateSitePanelProps {
  /** Text typed in the site field: the name to start from. */
  initialName: string;
  /** « Mes sites »: a close one is offered instead of a duplicate. */
  sites: readonly DiveFormSiteOption[];
  /** Regions already used, most dived first. */
  regions: readonly string[];
  /** Region of the latest dive, prefilled. */
  lastRegion: string | null;
  /** Creates the site and selects it; a rejection keeps the panel open with a message. */
  onCreate: (draft: SiteDraft) => Promise<void>;
  onUseExisting: (site: DiveFormSiteOption) => void;
  /** Annuler, ✕ or Échap: nothing is created. */
  onCancel: () => void;
}

/** The types offered at once (sites.jsx · QuickFields); the others on the map page. */
const QUICK_TYPES: readonly SiteType[] = ['tombant', 'epave', 'sec', 'grotte', 'autre'];

const TITLE = 'Nouveau site';
const NAME_REQUIRED = 'Donne un nom au site.';
const CREATE_FAILED = 'Le site n’a pas pu être créé. Réessaie.';
const LAST_REGION_HINT = 'Comme ta dernière plongée · modifiable';
const LATER_ON_MAP = 'Tu pourras placer le site sur la carte plus tard, depuis la page Carte.';

/** Same bound as `until($bp-tablet)` in SCSS: a bottom sheet on phones, a panel above. */
const PHONE = `(max-width: ${breakpoint.tablet - 1}px)`;

const regionOption = (region: string): ComboboxOption => ({ id: region, label: region });

/**
 * Quick creation of a site from the site field of the dive form (sites.jsx · QuickCreateDesktop /
 * QuickCreateMobile): name, region, type, without leaving the form. Under the field on tablets and
 * desktops (non-modal dialog), a modal bottom sheet on phones. Mount it per creation (`key`).
 */
export function QuickCreateSitePanel({
  initialName,
  sites,
  regions,
  lastRegion,
  onCreate,
  onUseExisting,
  onCancel,
}: QuickCreateSitePanelProps) {
  const isPhone = useMediaQuery(PHONE);
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [region, setRegion] = useState(lastRegion ?? '');
  const [type, setType] = useState<SiteType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedName = name.trim();
  const similar = trimmedName === '' ? undefined : searchSites(sites, trimmedName)[0];
  const regionOptions = regions.map(regionOption);

  const create = () => {
    if (isPending) return;
    if (trimmedName === '') {
      setError(NAME_REQUIRED);
      nameRef.current?.focus();
      return;
    }
    startTransition(async () => {
      try {
        await onCreate({
          name: trimmedName,
          region: region.trim() === '' ? null : region.trim(),
          type,
          depthMinM: null,
          depthMaxM: null,
          position: null,
          accessNotes: null,
        });
      } catch {
        // The diver sees it and can try again; nothing was selected.
        setError(CREATE_FAILED);
      }
    });
  };

  // Entrée in a field creates (the combobox of the regions keeps it while its list is open);
  // Échap cancels, unless a list took it first.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      create();
    } else if (event.key === 'Escape' && !isPhone) {
      event.preventDefault();
      onCancel();
    }
  };

  // The bottom sheet focuses the name through its focus trap; the panel does it on mounting.
  useEffect(() => {
    if (!isPhone) nameRef.current?.focus();
  }, [isPhone]);

  const fields = (
    // Keyboard shortcuts of the fields inside (Entrée, Échap): no role of its own.
    <div className={styles.fields} onKeyDown={onKeyDown}>
      <div role="status" className={styles.similarRegion}>
        {similar && (
          <p className={styles.similar}>
            <span>
              Un site proche existe : <strong className={styles.similarName}>{similar.name}</strong>{' '}
              <span className={styles.count}>({formatDiveCount(similar.diveCount)})</span>
            </span>
            <Button variant="ghost" onClick={() => onUseExisting(similar)}>
              Utiliser celui-ci
            </Button>
          </p>
        )}
      </div>
      <FormField label="Nom" required error={error}>
        <TextInput
          ref={nameRef}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          readOnly={isPending}
        />
      </FormField>
      <FormField
        label="Région"
        hint={region !== '' && region === lastRegion ? LAST_REGION_HINT : undefined}
      >
        <Combobox
          options={regionOptions}
          inputValue={region}
          onInputChange={setRegion}
          onSelect={(option) => setRegion(option.label)}
          groupLabel="Tes régions"
          icon="pin"
          placeholder="Calvi · Corse"
          end={<Icon name="chevronDown" size="sm" className={styles.chevron} />}
        />
      </FormField>
      <div role="group" aria-labelledby={`${titleId}-type`} className={styles.typeGroup}>
        <span id={`${titleId}-type`} className={styles.typeLabel}>
          Type (facultatif)
        </span>
        <div className={styles.types}>
          {QUICK_TYPES.map((option) => (
            <Chip
              key={option}
              selected={type === option}
              onClick={() => setType(type === option ? null : option)}
            >
              {SITE_TYPE_LABELS[option]}
            </Chip>
          ))}
        </div>
      </div>
      <p className={styles.info}>
        <Icon name="info" size="sm" className={styles.infoIcon} />
        {LATER_ON_MAP}
      </p>
    </div>
  );

  const createButton = (
    <Button
      variant="primary"
      size={isPhone ? 'lg' : 'md'}
      icon="check"
      onClick={create}
      aria-disabled={isPending}
      className={isPhone ? styles.wide : undefined}
    >
      Créer et sélectionner
    </Button>
  );

  if (isPhone) {
    return (
      <Sheet
        open
        onClose={onCancel}
        title={TITLE}
        height="content"
        initialFocusRef={nameRef}
        footer={createButton}
      >
        {fields}
      </Sheet>
    );
  }

  return (
    <div role="dialog" aria-labelledby={titleId} className={styles.panel}>
      <span className={styles.tail} aria-hidden="true" />
      <div className={styles.head}>
        <h3 id={titleId} className={styles.title}>
          {TITLE}
        </h3>
        <span className={styles.escape} aria-hidden="true">
          Échap pour annuler
        </span>
      </div>
      {fields}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        {createButton}
      </div>
    </div>
  );
}
