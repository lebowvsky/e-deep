import { useId, type ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { NOTHING_ENTERED } from '../../../lib/labels';
import styles from './DetailSection.module.scss';

export interface DetailSectionProps {
  title: string;
  icon: IconName;
  /** Right side of the title row (« Saisie manuelle »). */
  aside?: ReactNode;
  className?: string | undefined;
  /** Nothing entered at all: the card keeps its title and says so instead of its content. */
  empty?: boolean;
  children: ReactNode;
}

/** A card of the dive detail: a titled section (h2 styled as an overline, dive-detail.jsx · CardHead). */
export function DetailSection({
  title,
  icon,
  aside,
  className,
  empty = false,
  children,
}: DetailSectionProps) {
  const titleId = useId();
  return (
    <section className={cx(styles.section, className)} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          <Icon name={icon} size="sm" />
          {title}
        </h2>
        {aside}
      </div>
      {empty ? <p className={styles.empty}>{NOTHING_ENTERED}</p> : children}
    </section>
  );
}
