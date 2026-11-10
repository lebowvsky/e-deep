import { formatHoursMinutes } from '@/shared/lib/format';
import { Chip } from '@/shared/ui/Chip';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { Select } from '@/shared/ui/Select';
import { activeFilterKeys } from '../../lib/query';
import { FILTER_TITLES, SORT_OPTIONS } from '../../lib/labels';
import type { DivesFacets, DivesQuery, DivesSummary } from '../../types';
import { FilterButton } from '../FilterButton';
import { FilterSection, type FilterChange, type FilterSectionKey } from '../FilterSection';
import { SearchField } from '../SearchField';
import styles from './DivesToolbar.module.scss';

export interface DivesToolbarProps {
  query: DivesQuery;
  onChange: FilterChange;
  facets: DivesFacets;
  summary: DivesSummary;
  now: Date;
  /** Phones: opens the filters sheet, on a section or at the top. */
  onOpenFilters: (section?: FilterSectionKey) => void;
}

const FILTERS: FilterSectionKey[] = ['period', 'regions', 'depth', 'gases', 'with'];
/** Shortcut chips of the phone layout (the dive team stays in the sheet). */
const MOBILE_SHORTCUTS: FilterSectionKey[] = ['period', 'regions', 'depth', 'gases'];

/**
 * Search, filters and sort (dives-list.jsx · Toolbar). Desktop: one popover per filter. Phones:
 * scrolling chips that open the filters sheet, and the size of the selection next to the sort.
 */
export function DivesToolbar({
  query,
  onChange,
  facets,
  summary,
  now,
  onOpenFilters,
}: DivesToolbarProps) {
  const active = activeFilterKeys(query);
  const isActive = (filter: FilterSectionKey) => active.includes(filter);

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
                  active={isActive(filter)}
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

      <ul className={styles.shortcuts} aria-label="Filtres">
        <li>
          <Chip
            active={active.length > 0}
            icon={<Icon name="sliders" size="sm" />}
            aria-haspopup="dialog"
            onClick={() => onOpenFilters()}
          >
            Filtres{active.length > 0 && ` · ${active.length}`}
          </Chip>
        </li>
        {MOBILE_SHORTCUTS.map((filter) => (
          <li key={filter}>
            <Chip
              active={isActive(filter)}
              aria-haspopup="dialog"
              aria-label={isActive(filter) ? `${FILTER_TITLES[filter]}, filtre actif` : undefined}
              onClick={() => onOpenFilters(filter)}
            >
              {FILTER_TITLES[filter]}
            </Chip>
          </li>
        ))}
      </ul>

      <p className={styles.count}>
        <span className={styles.figure}>{summary.count}</span>{' '}
        {summary.count > 1 ? 'plongées' : 'plongée'}
        {summary.count > 0 && ` · ${formatHoursMinutes(summary.totalMinutes)}`}
      </p>

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
