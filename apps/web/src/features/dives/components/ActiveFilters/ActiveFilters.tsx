import { useId } from 'react';
import type { DiveMember } from '@/shared/model/dive';
import { RemovableChip } from '@/shared/ui/Chip';
import { describeFilter } from '../../lib/labels';
import { activeFilterKeys } from '../../lib/query';
import type { DivesFilterKey, DivesQuery } from '../../types';
import styles from './ActiveFilters.module.scss';

export interface ActiveFiltersProps {
  query: DivesQuery;
  members: readonly DiveMember[];
  onRemove: (filter: DivesFilterKey) => void;
  onReset: () => void;
}

/** Applied filters as removable chips, plus « Tout réinitialiser » (dives-list.jsx · capture 11). */
export function ActiveFilters({ query, members, onRemove, onReset }: ActiveFiltersProps) {
  const titleId = useId();
  const filters = activeFilterKeys(query).map((key) => describeFilter(query, key, members));
  if (filters.length === 0) return null;

  return (
    <div className={styles.bar}>
      <span className={styles.title} id={titleId}>
        Filtres actifs :
      </span>
      <ul className={styles.chips} aria-labelledby={titleId}>
        {filters.map((filter) => (
          <li key={filter.key}>
            <RemovableChip
              removeLabel={`Retirer le filtre ${filter.label}`}
              onRemove={() => onRemove(filter.key)}
            >
              {filter.label}
            </RemovableChip>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.reset} onClick={onReset}>
        Tout réinitialiser
      </button>
    </div>
  );
}
