import { useState, useTransition } from 'react';
import { formatDiveCount } from '@/shared/lib/format';
import type { Site, SiteEntry } from '@/shared/model/site';
import { searchSites } from '@/shared/sites/lib/searchSites';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { FormField } from '@/shared/ui/FormField';
import styles from './MergeSiteDialog.module.scss';

export interface MergeSiteDialogProps {
  source: SiteEntry;
  /** The user's sites: the targets to choose from (the source left out). */
  entries: readonly SiteEntry[];
  /** Writes the merge (`mergeSites`, on the API): the completed target. */
  merge: (source: Site, target: Site) => Promise<Site>;
  onMerged: (target: Site) => void;
  onCancel: () => void;
}

interface TargetOption extends ComboboxOption {
  name: string;
  diveCount: number;
  site: Site;
}

const searchTargets = (options: readonly TargetOption[], query: string) =>
  searchSites(options, query);

const MERGE_FAILED = 'La fusion n’a pas abouti. Réessaie.';

/** « Les 3 plongées de A seront rattachées à B. » (sites.md · Fusionner) */
function divesSentence(count: number, source: string, target: string): string {
  if (count === 0) return `${source} n’a pas de plongée à rattacher.`;
  if (count === 1) return `La plongée de ${source} sera rattachée à ${target}.`;
  return `Les ${count} plongées de ${source} seront rattachées à ${target}.`;
}

/**
 * « Fusionner « A » avec… » (sites.md): the target site, chosen with the tolerant search, then
 * what the merge does. Irreversible: the button is a danger one. Mount it per opening.
 */
export function MergeSiteDialog({
  source,
  entries,
  merge,
  onMerged,
  onCancel,
}: MergeSiteDialogProps) {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Site | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const options: TargetOption[] = entries
    .filter(({ site }) => site.id !== source.site.id)
    .map(({ site, stats }) => ({
      id: site.id,
      label: site.name,
      name: site.name,
      diveCount: stats.diveCount,
      description: site.region ?? undefined,
      meta: formatDiveCount(stats.diveCount),
      site,
    }));
  const a = source.site.name;

  const confirm = () => {
    if (!target || isPending) return;
    startTransition(async () => {
      try {
        onMerged(await merge(source.site, target));
      } catch {
        setError(MERGE_FAILED);
      }
    });
  };

  return (
    <ConfirmDialog
      open
      title={`Fusionner « ${a} » avec…`}
      cancelLabel="Annuler"
      confirmLabel="Fusionner"
      confirmVariant="danger"
      confirmDisabled={target === null || isPending}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className={styles.body}>
        <FormField label="Site cible" required error={error}>
          <Combobox
            options={options}
            filter={searchTargets}
            inputValue={query}
            onInputChange={(value) => {
              setQuery(value);
              setTarget(null);
            }}
            onSelect={(option) => {
              setQuery(option.label);
              setTarget(option.site);
            }}
            groupLabel="Mes sites"
            icon="search"
            optionIcon="pin"
            placeholder="Rechercher un site…"
            emptyMessage="Aucun site ne correspond."
          />
        </FormField>
        {target && (
          <p className={styles.summary} role="status">
            {divesSentence(source.stats.diveCount, a, target.name)} Les infos de {target.name} sont
            conservées ; les champs vides de {target.name} sont complétés avec ceux de {a}. {a} sera
            supprimé. <strong className={styles.warning}>Action irréversible.</strong>
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}
