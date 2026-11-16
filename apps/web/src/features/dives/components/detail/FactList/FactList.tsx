import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './FactList.module.scss';

export interface Fact {
  term: string;
  /** Plain text (sans) or a `Quantity` (mono, with its spoken form). */
  value: ReactNode;
  /** Secondary line under the value (« 21 % O₂ »). */
  note?: string | null | undefined;
}

export interface FactListProps {
  facts: readonly Fact[];
  /** rows: term left, value right (dive-detail.jsx · KV) · cells: term above value, side by side */
  layout: 'rows' | 'cells';
  className?: string | undefined;
}

/** Key / value facts of a dive, as a description list. */
export function FactList({ facts, layout, className }: FactListProps) {
  return (
    <dl className={cx(styles.list, styles[layout], className)}>
      {facts.map((fact) => (
        <div key={fact.term} className={styles.fact}>
          <dt className={styles.term}>{fact.term}</dt>
          <dd className={styles.value}>
            {fact.value}
            {fact.note && <span className={styles.note}>{fact.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
