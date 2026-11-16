import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import { MISSING_LABELS, type MissingLabel } from '../../../lib/labels';
import styles from './FactList.module.scss';

export interface Fact {
  term: string;
  /** Plain text (sans) or a `Quantity` (mono, with its spoken form); `null` when not entered. */
  value: ReactNode;
  /** Secondary line under the value (« 21 % O₂ »). */
  note?: string | null | undefined;
  /** `false` when the value's spoken form already says it (« surface → fond »). */
  noteSpoken?: boolean | undefined;
  /** Agreed with the term when the value is missing (« Mer : Non renseignée »). */
  missingLabel?: MissingLabel | undefined;
}

export interface FactListProps {
  facts: readonly Fact[];
  /** rows: term left, value right (dive-detail.jsx · KV) · cells: term above value, side by side */
  layout: 'rows' | 'cells';
  className?: string | undefined;
}

/**
 * Key / value facts of a dive, as a description list. A missing value reads « — » (decorative,
 * textMuted) then « Non renseigné(e) » (textLow, AA): the words carry the information.
 */
export function FactList({ facts, layout, className }: FactListProps) {
  return (
    <dl className={cx(styles.list, styles[layout], className)}>
      {facts.map((fact) => (
        <div key={fact.term} className={styles.fact}>
          <dt className={styles.term}>{fact.term}</dt>
          <dd className={styles.value}>
            {fact.value === null ? (
              <span className={styles.missing}>
                <span className={styles.dash} aria-hidden="true">
                  —
                </span>
                {fact.missingLabel ?? MISSING_LABELS.masculine}
              </span>
            ) : (
              <>
                {fact.value}
                {fact.note && (
                  <span
                    className={styles.note}
                    aria-hidden={fact.noteSpoken === false ? true : undefined}
                  >
                    {fact.note}
                  </span>
                )}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
