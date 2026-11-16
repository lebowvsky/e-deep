import { useId, type ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import { Icon, type IconName } from '@/shared/ui/Icon';
import styles from './DetailSection.module.scss';

export interface DetailSectionProps {
  title: string;
  icon: IconName;
  /** Right side of the title row (« Saisie manuelle »). */
  aside?: ReactNode;
  className?: string | undefined;
  children: ReactNode;
}

/** A card of the dive detail: a titled section (h2 styled as an overline, dive-detail.jsx · CardHead). */
export function DetailSection({ title, icon, aside, className, children }: DetailSectionProps) {
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
      {children}
    </section>
  );
}
