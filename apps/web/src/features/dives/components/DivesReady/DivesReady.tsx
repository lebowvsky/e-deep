import { formatDiveCount } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { withoutFilter, withoutFilters } from '../../lib/query';
import type { DivesQuery, DivesState } from '../../types';
import { ActiveFilters } from '../ActiveFilters';
import { DivesTable } from '../DivesTable';
import { DivesToolbar } from '../DivesToolbar';
import type { FilterChange } from '../FilterSection';
import { Pagination } from '../Pagination';
import { SelectionSummary } from '../SelectionSummary';
import styles from './DivesReady.module.scss';

export interface DivesReadyProps {
  state: Extract<DivesState, { status: 'ready' }>;
  query: DivesQuery;
  onChange: FilterChange;
  now: Date;
}

/** Nominal dive log: toolbar, active filters, summary of the selection, table and pagination. */
export function DivesReady({ state, query, onChange, now }: DivesReadyProps) {
  const members = state.facets.members.map(({ member }) => member);

  return (
    <div className={styles.ready}>
      <DivesToolbar query={query} onChange={onChange} facets={state.facets} now={now} />
      <ActiveFilters
        query={query}
        members={members}
        onRemove={(filter) => onChange(withoutFilter(query, filter))}
        onReset={() => onChange(withoutFilters(query))}
      />
      <SelectionSummary summary={state.summary} />
      {/* Announces the size of the selection after each change of the filters or the search. */}
      <p className={styles.srOnly} role="status">
        {formatDiveCount(state.total)} dans la sélection
      </p>
      <Card padding="none" className={styles.card}>
        <DivesTable dives={state.items} summary={state.summary} sort={query.sort} />
        <Pagination
          page={state.page}
          pageCount={state.pageCount}
          size={query.size}
          total={state.total}
          onPage={(page) => onChange({ page })}
          onSize={(size) => onChange({ size })}
        />
      </Card>
    </div>
  );
}
