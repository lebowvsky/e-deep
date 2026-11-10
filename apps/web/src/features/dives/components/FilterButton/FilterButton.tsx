import type { PopoverTriggerProps } from '@/shared/ui/Popover';
import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import styles from './FilterButton.module.scss';

export interface FilterButtonProps extends PopoverTriggerProps {
  label: string;
  /** A value is applied: accent fill and dot. */
  active: boolean;
}

/** Toolbar filter (dives-list.jsx · FilterBtn): opens its popover. */
export function FilterButton({ label, active, ref, ...trigger }: FilterButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(styles.button, active && styles.active)}
      // The visible label starts the accessible name (WCAG 2.5.3).
      aria-label={active ? `${label}, filtre actif` : undefined}
      {...trigger}
    >
      {label}
      {active && <span className={styles.dot} aria-hidden="true" />}
      <Icon name="chevronDown" size="sm" className={styles.chevron} />
    </button>
  );
}
