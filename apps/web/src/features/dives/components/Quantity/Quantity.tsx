import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './Quantity.module.scss';

export interface QuantityProps {
  value: ReactNode;
  unit?: string | undefined;
  /** Spoken form, value and unit together: « 42 mètres » (design/README.md § 6). */
  srText: string;
  /** summary: summary band · cell: table cell */
  size: 'summary' | 'cell';
  /** muted: secondary value (temperature) · empty: placeholder (« — ») */
  tone?: 'default' | 'muted' | 'empty';
  className?: string | undefined;
}

/** Mono tabular number with a smaller unit in textLow. The visual text is hidden from readers. */
export function Quantity({
  value,
  unit,
  srText,
  size,
  tone = 'default',
  className,
}: QuantityProps) {
  return (
    <span className={cx(styles.quantity, styles[size], styles[tone], className)}>
      <span aria-hidden="true">
        <span className={styles.value}>{value}</span>
        {unit && <span className={styles.unit}> {unit}</span>}
      </span>
      <span className={styles.srOnly}>{srText}</span>
    </span>
  );
}
