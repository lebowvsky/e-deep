import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { useLeaveConfirmation } from '@/shared/hooks/useLeaveConfirmation';
import { parseNumberInput } from '@/shared/lib/numberInput';
import type { GeoPoint } from '@/shared/model/geo';
import { SITE_TYPES, type Site, type SiteDraft, type SiteType } from '@/shared/model/site';
import { SITE_TYPE_LABELS } from '@/shared/sites/lib/labels';
import { suggestRegion } from '@/shared/sites/lib/suggestRegion';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { NumberInput } from '@/shared/ui/NumberInput';
import { Overline } from '@/shared/ui/Overline';
import { Textarea } from '@/shared/ui/Textarea';
import { TextInput } from '@/shared/ui/TextInput';
import type { MapPanel } from '../../lib/mapQuery';
import { CoordinatesInput } from '../CoordinatesInput';
import styles from './SitePanel.module.scss';

export interface SitePanelProps {
  mode: MapPanel['kind'];
  /** The site to place or edit; `null` for a new one. */
  site: Site | null;
  /** The user's sites: regions to choose from, and the closest one to suggest a region. */
  sites: readonly Site[];
  /** The marker on the map (the page holds it: the map moves it too). */
  position: GeoPoint | null;
  onPositionChange: (position: GeoPoint | null) => void;
  /** `click` on the map (default), or `center`: the map moves under a fixed marker (phones). */
  placing?: 'click' | 'center';
  /** Writes the site (`createSite` or `updateSite`). */
  save: (draft: SiteDraft, site: Site | null) => Promise<Site>;
  onSaved: (site: Site) => void;
  /** Annuler, ✕ or Échap; changes not saved are confirmed on the way out. */
  onClose: () => void;
}

const TITLES: Record<SitePanelProps['mode'], string> = {
  new: 'Nouveau site',
  place: 'Placer le site',
  edit: 'Modifier le site',
};

const HELP = {
  click: 'Clique sur la carte pour placer le site, puis ajuste en glissant le repère.',
  center: 'Déplace la carte pour placer le repère sur le site.',
} as const;
const NAME_REQUIRED = 'Donne un nom au site.';
const DEPTH_ORDER = 'La profondeur min dépasse la max.';
const SAVE_FAILED = 'Le site n’a pas pu être enregistré. Réessaie.';

const text = (value: number | null) => (value === null ? '' : String(value).replace('.', ','));

const samePosition = (a: GeoPoint | null, b: GeoPoint | null) =>
  a === b || (a !== null && b !== null && a.latitude === b.latitude && a.longitude === b.longitude);

/**
 * Add, place or edit a site (sites.jsx · MapAddSiteDesktop), beside the map that stays usable:
 * a click on the map puts the marker, coordinates can be typed or pasted, the region is suggested
 * from the closest site. Leaving with unsaved changes asks first. Mount it per panel (`key`).
 */
export function SitePanel({
  mode,
  site,
  sites,
  position,
  onPositionChange,
  placing = 'click',
  save,
  onSaved,
  onClose,
}: SitePanelProps) {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(site?.name ?? '');
  const [typedRegion, setTypedRegion] = useState<string | null>(null);
  const [type, setType] = useState<SiteType | null>(site?.type ?? null);
  const [depthMin, setDepthMin] = useState(text(site?.depthMinM ?? null));
  const [depthMax, setDepthMax] = useState(text(site?.depthMaxM ?? null));
  const [accessNotes, setAccessNotes] = useState(site?.accessNotes ?? '');
  const [errors, setErrors] = useState<{ name?: string; depth?: string; save?: string }>({});
  const [isPending, startTransition] = useTransition();

  // The region: what the diver typed, else the site's own, else the one of the closest site.
  const suggestion = position ? suggestRegion(position, sites, site?.id ?? null) : null;
  const region = typedRegion ?? site?.region ?? suggestion ?? '';
  const isSuggested = typedRegion === null && !site?.region && suggestion !== null;
  const regionOptions: ComboboxOption[] = [
    ...new Set(sites.flatMap(({ region: own }) => (own ? [own] : []))),
  ].map((own) => ({ id: own, label: own }));

  const isDirty =
    name !== (site?.name ?? '') ||
    typedRegion !== null ||
    type !== (site?.type ?? null) ||
    depthMin !== text(site?.depthMinM ?? null) ||
    depthMax !== text(site?.depthMaxM ?? null) ||
    accessNotes !== (site?.accessNotes ?? '') ||
    !samePosition(position, site?.position ?? null);
  const { blocker, release } = useLeaveConfirmation(isDirty);

  // Focus on the first field when the panel opens (spec: dialog, first field).
  useEffect(() => {
    bodyRef.current?.querySelector('input')?.focus();
  }, []);

  const submit = () => {
    if (isPending) return;
    const minM = parseNumberInput(depthMin);
    const maxM = parseNumberInput(depthMax);
    const next = {
      ...(name.trim() === '' ? { name: NAME_REQUIRED } : {}),
      ...(minM !== null && maxM !== null && minM > maxM ? { depth: DEPTH_ORDER } : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const draft: SiteDraft = {
      name,
      region,
      type,
      depthMinM: minM,
      depthMaxM: maxM,
      position,
      accessNotes,
    };
    startTransition(async () => {
      try {
        const saved = await save(draft, site);
        // Saved: closing the panel must not ask about changes that are now kept.
        release();
        onSaved(saved);
      } catch {
        setErrors({ save: SAVE_FAILED });
      }
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !event.defaultPrevented && blocker.state !== 'blocked') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    // Échap closes the panel (non-modal dialog), unless a list inside took it.
    <div role="dialog" aria-labelledby={titleId} className={styles.panel} onKeyDown={onKeyDown}>
      <div className={styles.head}>
        <div>
          {mode === 'place' && <Overline as="p">Compléter un site express</Overline>}
          <h2 id={titleId} className={styles.title}>
            {TITLES[mode]}
          </h2>
        </div>
        <IconButton icon="close" variant="ghost" label="Fermer le panneau" onClick={onClose} />
      </div>
      <div ref={bodyRef} className={styles.body}>
        <p className={styles.help}>
          <Icon name="crosshair" size="md" className={styles.helpIcon} />
          {HELP[placing]}
        </p>
        <CoordinatesInput value={position} onChange={onPositionChange} />
        <FormField label="Nom" required error={errors.name}>
          <TextInput
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setErrors(({ name: _name, ...rest }) => rest);
            }}
            readOnly={isPending}
          />
        </FormField>
        <FormField label="Région" hint={isSuggested ? 'Suggérée depuis la position' : undefined}>
          <Combobox
            options={regionOptions}
            inputValue={region}
            onInputChange={setTypedRegion}
            onSelect={(option) => setTypedRegion(option.label)}
            groupLabel="Tes régions"
            icon="pin"
            placeholder="Calvi · Corse"
            end={<Icon name="chevronDown" size="sm" className={styles.chevron} />}
          />
        </FormField>
        <div role="group" aria-labelledby={`${titleId}-type`} className={styles.group}>
          <span id={`${titleId}-type`} className={styles.groupLabel}>
            Type
          </span>
          <div className={styles.types}>
            {SITE_TYPES.map((option) => (
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
        <div className={styles.pair}>
          <FormField label="Profondeur min" error={errors.depth}>
            <NumberInput
              value={depthMin}
              onValueChange={setDepthMin}
              unit="m"
              unitLabel="mètres"
              decimal
            />
          </FormField>
          <FormField label="Profondeur max">
            <NumberInput
              value={depthMax}
              onValueChange={setDepthMax}
              unit="m"
              unitLabel="mètres"
              decimal
            />
          </FormField>
        </div>
        <FormField
          label="Accès & conseils"
          hint="Mouillage, courant, repères… visible sur la fiche"
        >
          <Textarea
            value={accessNotes}
            onChange={(event) => setAccessNotes(event.target.value)}
            placeholder="Ex. : mouillage côté nord, entrée à 12 m…"
            className={styles.notes}
          />
        </FormField>
        {errors.save && (
          <p role="alert" className={styles.saveError}>
            {errors.save}
          </p>
        )}
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" icon="check" onClick={submit} aria-disabled={isPending}>
          Enregistrer le site
        </Button>
      </div>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Quitter sans enregistrer ?"
        description="Les modifications de ce site seront perdues."
        cancelLabel="Rester"
        confirmLabel="Quitter"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
