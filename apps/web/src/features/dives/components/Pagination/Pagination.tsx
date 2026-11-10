import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { pageItems } from '../../lib/pagination';
import { PAGE_SIZES, type PageSize } from '../../types';
import styles from './Pagination.module.scss';

export interface PaginationProps {
  page: number;
  pageCount: number;
  size: PageSize;
  total: number;
  onPage: (page: number) => void;
  onSize: (size: PageSize) => void;
}

const SIZE_OPTIONS = PAGE_SIZES.map((size) => ({ value: `${size}`, label: `${size}` }) as const);

/** Footer of the table (dives-list.jsx · Pagination): range, pages, page size. */
export function Pagination({ page, pageCount, size, total, onPage, onSize }: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * size + 1;
  const last = Math.min(page * size, total);

  return (
    <div className={styles.pagination}>
      <p className={styles.range}>
        <span className={styles.figure}>
          {first}–{last}
        </span>{' '}
        sur <span className={styles.figure}>{total}</span> plongées
      </p>

      <nav aria-label="Pages">
        <ul className={styles.pages}>
          <li>
            <button
              type="button"
              className={styles.page}
              disabled={page <= 1}
              aria-label="Page précédente"
              onClick={() => onPage(page - 1)}
            >
              <Icon name="chevronLeft" size="md" />
            </button>
          </li>
          {pageItems(page, pageCount).map((item, index) =>
            item === 'gap' ? (
              <li key={`gap-${index}`} className={cx(styles.page, styles.gap)} aria-hidden="true">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  className={cx(styles.page, item === page && styles.current)}
                  aria-current={item === page ? 'page' : undefined}
                  aria-label={`Page ${item}`}
                  onClick={() => onPage(item)}
                >
                  {item}
                </button>
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              className={styles.page}
              disabled={page >= pageCount}
              aria-label="Page suivante"
              onClick={() => onPage(page + 1)}
            >
              <Icon name="chevronRight" size="md" />
            </button>
          </li>
        </ul>
      </nav>

      <div className={styles.size}>
        <span aria-hidden="true">Afficher</span>
        <Select
          variant="outlined"
          label="Plongées par page"
          options={SIZE_OPTIONS}
          value={`${size}`}
          onChange={(value) => onSize(PAGE_SIZES.find((option) => `${option}` === value) ?? size)}
        />
        <span aria-hidden="true">par page</span>
      </div>
    </div>
  );
}
