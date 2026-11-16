import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { describeFilter, type FilterNames } from '../../lib/labels';
import { withoutFilter, withoutFilters } from '../../lib/query';
import type { DivesQuery, DivesState } from '../../types';
import { ActiveFilters } from '../ActiveFilters';
import { DiveCardList } from '../DiveCardList';
import { DivesNoResults } from '../DivesNoResults';
import { DivesTable } from '../DivesTable';
import { DivesToolbar } from '../DivesToolbar';
import type { FilterChange, FilterSectionKey } from '../FilterSection';
import { FiltersSheet } from '../FiltersSheet';
import { Pagination } from '../Pagination';
import { SelectionSummary } from '../SelectionSummary';
import styles from './DivesReady.module.scss';

export interface DivesReadyProps {
  state: Extract<DivesState, { status: 'ready' }>;
  query: DivesQuery;
  onChange: FilterChange;
  now: Date;
}

type SheetState = { open: false } | { open: true; section: FilterSectionKey | undefined };

/**
 * Nominal dive log: toolbar, active filters, summary of the selection, then the dives — a table
 * from 1024px, cards below — and the pagination.
 */
export function DivesReady({ state, query, onChange, now }: DivesReadyProps) {
  const [sheet, setSheet] = useState<SheetState>({ open: false });

  const noResults = state.total === 0 && (
    <DivesNoResults
      relaxation={relaxationLabel(state, query, state.facets)}
      onRelax={() => state.relaxation && onChange(withoutFilter(query, state.relaxation.filter))}
      onReset={() => onChange(withoutFilters(query))}
    />
  );

  const pagination = state.total > 0 && (
    <Pagination
      page={state.page}
      pageCount={state.pageCount}
      size={query.size}
      total={state.total}
      onPage={(page) => onChange({ page })}
      onSize={(size) => onChange({ size })}
    />
  );

  return (
    <div className={styles.ready}>
      <DivesToolbar
        query={query}
        onChange={onChange}
        facets={state.facets}
        summary={state.summary}
        now={now}
        onOpenFilters={(section) => setSheet({ open: true, section })}
      />
      <ActiveFilters
        query={query}
        names={state.facets}
        onRemove={(filter) => onChange(withoutFilter(query, filter))}
        onReset={() => onChange(withoutFilters(query))}
      />
      <SelectionSummary summary={state.summary} />

      <Card padding="none" className={styles.tableCard}>
        <DivesTable dives={state.items} summary={state.summary} sort={query.sort} />
        {noResults}
        {pagination}
      </Card>
      <div className={styles.cards}>
        {noResults || (
          <DiveCardList dives={state.items} summary={state.summary} sort={query.sort} />
        )}
        {pagination}
      </div>

      {sheet.open && (
        <FiltersSheet
          query={query}
          facets={state.facets}
          now={now}
          count={state.count}
          initialSection={sheet.section}
          onApply={(draft) => {
            onChange(draft);
            setSheet({ open: false });
          }}
          onClose={() => setSheet({ open: false })}
        />
      )}
    </div>
  );
}

/** « « ≥ 40 m » » — the filter to remove, quoted (the search value is already quoted). */
function relaxationLabel(
  state: DivesReadyProps['state'],
  query: DivesQuery,
  names: FilterNames,
): { label: string; total: number } | null {
  if (!state.relaxation) return null;
  const { filter, total } = state.relaxation;
  const { value } = describeFilter(query, filter, names);
  return { label: filter === 'q' ? value : `« ${value} »`, total };
}
