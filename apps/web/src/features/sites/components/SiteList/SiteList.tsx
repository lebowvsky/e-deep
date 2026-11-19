import { useEffect, useMemo, useRef, useState } from 'react';
import { layout } from '@/design/tokens';
import { cx } from '@/shared/lib/classNames';
import { SITE_TYPES, type SiteEntry, type SiteType } from '@/shared/model/site';
import { SITE_TYPE_LABELS } from '@/shared/sites/lib/labels';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import {
  regionGroups,
  selectSites,
  SITE_SORT_LABELS,
  SITE_SORTS,
  toCompleteCount,
  type SiteListQuery,
  type SiteSort,
} from '../../lib/siteList';
import { SiteListItem } from '../SiteListItem';
import styles from './SiteList.module.scss';

export interface SiteListProps {
  entries: readonly SiteEntry[];
  query: SiteListQuery;
  onQueryChange: (patch: Partial<SiteListQuery>) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
  onPlace: (id: string) => void;
}

/** Beyond, only the rows in view are rendered (spec: virtualised above 100 sites). */
export const VIRTUALIZE_FROM = 100;
const ROW_HEIGHT = layout.rowHeight;
/** Rows rendered above and below the visible ones. */
const OVERSCAN = 6;

const ALL = 'all';
type TypeChoice = SiteType | typeof ALL;

const TYPE_OPTIONS: SelectOption<TypeChoice>[] = [
  { value: ALL, label: 'Type' },
  ...SITE_TYPES.map((type) => ({ value: type, label: SITE_TYPE_LABELS[type] })),
];

const SORT_OPTIONS: SelectOption<SiteSort>[] = SITE_SORTS.map((sort) => ({
  value: sort,
  label: SITE_SORT_LABELS[sort],
}));

/** First and last row to render for the scroll position (all of them under the threshold). */
function visibleRange(count: number, scrollTop: number, height: number) {
  if (count <= VIRTUALIZE_FROM) return { start: 0, end: count };
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(count, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  return { start, end };
}

/**
 * « Mes sites » beside the map (sites.jsx · ListPanel): search, Type and Région filters,
 * « À compléter », sort, and the rows. The selected row scrolls into view when the selection
 * comes from the map.
 */
export function SiteList({
  entries,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  onHighlight,
  onPlace,
}: SiteListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });
  // Not again on every scroll or hover: 500 sites searched and sorted once per change of query.
  const sites = useMemo(() => selectSites(entries, query), [entries, query]);
  const waiting = toCompleteCount(entries);
  const regionOptions: SelectOption<string>[] = useMemo(
    () => [
      { value: ALL, label: 'Région' },
      ...regionGroups(entries).map((group) => ({ value: group, label: group })),
    ],
    [entries],
  );
  const { start, end } = visibleRange(sites.length, viewport.scrollTop, viewport.height);
  const isVirtual = sites.length > VIRTUALIZE_FROM;
  const selectedIndex = sites.findIndex(({ site }) => site.id === selectedId);

  // Height of the scrolling area, for the rows to render (DOM measure, kept up to date).
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() =>
      setViewport((current) => ({ ...current, height: element.clientHeight })),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A site selected on the map: its row comes into view (scroll of the list only).
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || selectedId === null || selectedIndex < 0) return;
    const top = selectedIndex * ROW_HEIGHT;
    if (top < element.scrollTop || top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
      element.scrollTop = Math.max(0, top - (element.clientHeight - ROW_HEIGHT) / 2);
    }
  }, [selectedId, selectedIndex]);

  return (
    <section className={styles.list} aria-label="Liste de mes sites">
      <div className={styles.tools}>
        <TextInput
          type="search"
          icon="search"
          aria-label="Rechercher un site"
          placeholder="Rechercher un site…"
          value={query.q}
          onChange={(event) => onQueryChange({ q: event.target.value })}
          className={styles.search}
        />
        <div className={styles.filters}>
          <Select
            variant="outlined"
            label="Type de site"
            options={TYPE_OPTIONS}
            value={query.type ?? ALL}
            onChange={(type) => onQueryChange({ type: type === ALL ? null : type })}
          />
          <Select
            variant="outlined"
            label="Région"
            options={regionOptions}
            value={query.region ?? ALL}
            onChange={(region) => onQueryChange({ region: region === ALL ? null : region })}
          />
          {waiting > 0 && (
            <button
              type="button"
              className={cx(styles.toComplete, query.toComplete && styles.toCompleteOn)}
              aria-pressed={query.toComplete}
              onClick={() => onQueryChange({ toComplete: !query.toComplete })}
            >
              À compléter <span className={styles.toCompleteCount}>{waiting}</span>
            </button>
          )}
          <Select
            label="Trier les sites"
            icon="sort"
            options={SORT_OPTIONS}
            value={query.sort}
            onChange={(sort) => onQueryChange({ sort })}
            className={styles.sort}
            // A search ranks by relevance: the sort applies without one.
            disabled={query.q.trim() !== ''}
          />
        </div>
      </div>
      <div
        ref={scrollRef}
        className={styles.scroll}
        onScroll={(event) => {
          const { scrollTop } = event.currentTarget;
          if (isVirtual) setViewport((current) => ({ ...current, scrollTop }));
        }}
      >
        {sites.length === 0 ? (
          <p className={styles.none}>Aucun site ne correspond.</p>
        ) : (
          <ul
            className={styles.rows}
            style={
              isVirtual
                ? {
                    paddingTop: start * ROW_HEIGHT,
                    paddingBottom: (sites.length - end) * ROW_HEIGHT,
                  }
                : undefined
            }
          >
            {sites.slice(start, end).map((entry) => (
              <SiteListItem
                key={entry.site.id}
                entry={entry}
                isSelected={entry.site.id === selectedId}
                onSelect={onSelect}
                onHighlight={onHighlight}
                onPlace={onPlace}
              />
            ))}
          </ul>
        )}
      </div>
      <p className={styles.footer} aria-live="polite">
        <span className={styles.figure}>{sites.length}</span> sur{' '}
        <span className={styles.figure}>{entries.length}</span>{' '}
        {entries.length > 1 ? 'sites' : 'site'}
      </p>
    </section>
  );
}
