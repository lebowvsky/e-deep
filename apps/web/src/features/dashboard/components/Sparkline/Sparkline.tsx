import { iconStroke } from '@/design/tokens';
import { SPARK_HEIGHT, SPARK_WIDTH, sparklinePath } from '../../lib/sparkline';
import styles from './Sparkline.module.scss';

export interface SparklineProps {
  values: readonly number[];
  /** Soft accent area under the line. */
  fill?: boolean;
}

/** Decorative trend line pinned to the bottom of a KPI card (desktop / tablet). */
export function Sparkline({ values, fill = false }: SparklineProps) {
  const path = sparklinePath(values);
  if (!path) return null;

  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {fill && (
        <path
          className={styles.area}
          d={`${path} L${SPARK_WIDTH} ${SPARK_HEIGHT} L0 ${SPARK_HEIGHT} Z`}
        />
      )}
      <path
        className={styles.line}
        d={path}
        strokeWidth={iconStroke.regular}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
