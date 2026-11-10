import { useEffect, useRef, useState } from 'react';
import { formatDiveCount } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Sheet } from '@/shared/ui/Sheet';
import { withoutFilters } from '../../lib/query';
import type { DivesFacets, DivesQuery } from '../../types';
import { FilterSection, type FilterSectionKey } from '../FilterSection';
import styles from './FiltersSheet.module.scss';

export interface FiltersSheetProps {
  /** Applied query: the starting point of the draft. */
  query: DivesQuery;
  facets: DivesFacets;
  now: Date;
  /** Size of the selection the draft would give. */
  count: (query: DivesQuery) => number;
  /** Section to bring into view on opening (chip « Région » → region). */
  initialSection?: FilterSectionKey | undefined;
  onApply: (query: DivesQuery) => void;
  onClose: () => void;
}

const SECTIONS: FilterSectionKey[] = ['period', 'regions', 'depth', 'gases', 'with'];

/**
 * Mobile filters (dives-list.jsx · DivesMobileFilters). Changes stay in a draft until « Afficher
 * {n} plongées »; « Réinitialiser » only clears the draft. Mount it to open it.
 */
export function FiltersSheet({
  query,
  facets,
  now,
  count,
  initialSection,
  onApply,
  onClose,
}: FiltersSheetProps) {
  const [draft, setDraft] = useState(query);
  const sectionRefs = useRef(new Map<FilterSectionKey, HTMLDivElement>());
  const total = count(draft);

  useEffect(() => {
    if (!initialSection) return;
    sectionRefs.current.get(initialSection)?.scrollIntoView?.({ block: 'start' });
  }, [initialSection]);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Filtres"
      action={
        <Button variant="ghost" onClick={() => setDraft(withoutFilters(draft))}>
          Réinitialiser
        </Button>
      }
      footer={
        <Button variant="primary" size="lg" className={styles.apply} onClick={() => onApply(draft)}>
          Afficher {formatDiveCount(total)}
        </Button>
      }
    >
      {SECTIONS.map((section) => (
        <div
          key={section}
          className={styles.section}
          ref={(node) => {
            if (node) sectionRefs.current.set(section, node);
          }}
        >
          <FilterSection
            filter={section}
            query={draft}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            facets={facets}
            now={now}
          />
        </div>
      ))}
    </Sheet>
  );
}
