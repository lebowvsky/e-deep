import { cx } from '@/shared/lib/classNames';
import { Icon, type IconName } from '@/shared/ui/Icon';
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
            <StepButton
              label="Page précédente"
              icon="chevronLeft"
              isUnavailable={page <= 1}
              onClick={() => onPage(page - 1)}
            />
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
            <StepButton
              label="Page suivante"
              icon="chevronRight"
              isUnavailable={page >= pageCount}
              onClick={() => onPage(page + 1)}
            />
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

interface StepButtonProps {
  label: string;
  icon: IconName;
  /** At either end: announced and shown as unavailable, but the button keeps the focus. */
  isUnavailable: boolean;
  onClick: () => void;
}

/**
 * « Page précédente » / « Page suivante ». `aria-disabled` rather than `disabled`: reaching the
 * last page with the keyboard would otherwise disable the focused button and drop the focus on
 * `<body>` (WCAG 2.4.3).
 */
function StepButton({ label, icon, isUnavailable, onClick }: StepButtonProps) {
  return (
    <button
      type="button"
      className={styles.page}
      aria-label={label}
      aria-disabled={isUnavailable || undefined}
      onClick={() => {
        if (!isUnavailable) onClick();
      }}
    >
      <Icon name={icon} size="md" />
    </button>
  );
}
