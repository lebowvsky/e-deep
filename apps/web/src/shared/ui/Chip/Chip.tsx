import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import styles from './Chip.module.scss';

export interface ChipProps extends Omit<ComponentProps<'button'>, 'aria-pressed'> {
  /** Toggle state, announced with `aria-pressed`. Omit for a chip that only opens something. */
  selected?: boolean;
  /** Leading visual (icon, avatar). A selected chip shows a check mark instead when absent. */
  icon?: ReactNode;
  children: ReactNode;
}

/** Pill button, 36px high (dives-list.jsx · MChip): multi-choice filters, filter shortcuts. */
export function Chip({ selected, icon, className, type = 'button', children, ...rest }: ChipProps) {
  const leading = icon ?? (selected ? <Icon name="check" size="sm" weight="bold" /> : null);
  return (
    <button
      type={type}
      className={cx(styles.chip, selected && styles.selected, className)}
      aria-pressed={selected}
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
}

export interface RemovableChipProps {
  children: ReactNode;
  /** Accessible name of the remove button: « Retirer le filtre Région : Bretagne ». */
  removeLabel: string;
  onRemove: () => void;
  className?: string | undefined;
}

/** Applied filter, 30px high, with a remove button (dives-list.jsx · Chip). */
export function RemovableChip({ children, removeLabel, onRemove, className }: RemovableChipProps) {
  return (
    <span className={cx(styles.removable, className)}>
      {children}
      <button type="button" className={styles.remove} aria-label={removeLabel} onClick={onRemove}>
        <Icon name="close" size="xs" weight="bold" />
      </button>
    </span>
  );
}
