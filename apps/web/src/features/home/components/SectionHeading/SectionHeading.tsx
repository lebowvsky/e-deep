import { cx } from '@/shared/lib/classNames';
import { Overline } from '@/shared/ui/Overline';
import styles from './SectionHeading.module.scss';

export interface SectionHeadingProps {
  /** Id of the `h2`, for the section's `aria-labelledby`. */
  id: string;
  overline: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
}

/** Eyebrow, title and subtitle of a landing section (welcome.jsx · SectionTitle). */
export function SectionHeading({
  id,
  overline,
  title,
  subtitle,
  centered = false,
}: SectionHeadingProps) {
  return (
    <div className={cx(styles.heading, centered && styles.centered)}>
      <Overline tone="accent" as="p">
        {overline}
      </Overline>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
