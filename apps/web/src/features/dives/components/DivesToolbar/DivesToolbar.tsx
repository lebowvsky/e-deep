import { Popover } from '@/shared/ui/Popover';
import { Select } from '@/shared/ui/Select';
import { activeFilterKeys } from '../../lib/query';
import { FILTER_TITLES, SORT_OPTIONS } from '../../lib/labels';
import type { DivesFacets, DivesQuery } from '../../types';
import { FilterButton } from '../FilterButton';
import { FilterSection, type FilterChange, type FilterSectionKey } from '../FilterSection';
import { SearchField } from '../SearchField';
import styles from './DivesToolbar.module.scss';

export interface DivesToolbarProps {
  query: DivesQuery;
  onChange: FilterChange;
  facets: DivesFacets;
  now: Date;
}

const FILTERS: FilterSectionKey[] = ['period', 'regions', 'depth', 'gases', 'with'];

/** Search, filters (one popover each) and sort (dives-list.jsx · Toolbar). */
export function DivesToolbar({ query, onChange, facets, now }: DivesToolbarProps) {
  const active = activeFilterKeys(query);

  return (
    <div className={styles.toolbar}>
      <SearchField value={query.q} onChange={(q) => onChange({ q }, { replace: true })} />
      <span className={styles.separator} aria-hidden="true" />
      <ul className={styles.filters} aria-label="Filtres">
        {FILTERS.map((filter, index) => (
          <li key={filter}>
            <Popover
              label={`Filtre ${FILTER_TITLES[filter]}`}
              align={index >= FILTERS.length - 2 ? 'end' : 'start'}
              renderTrigger={(trigger) => (
                <FilterButton
                  label={FILTER_TITLES[filter]}
                  active={active.includes(filter)}
                  {...trigger}
                />
              )}
            >
              <FilterSection
                filter={filter}
                query={query}
                onChange={onChange}
                facets={facets}
                now={now}
              />
            </Popover>
          </li>
        ))}
      </ul>
      <Select
        className={styles.sort}
        label="Trier les plongées"
        icon="sort"
        options={SORT_OPTIONS}
        value={query.sort}
        onChange={(sort) => onChange({ sort })}
      />
    </div>
  );
}
