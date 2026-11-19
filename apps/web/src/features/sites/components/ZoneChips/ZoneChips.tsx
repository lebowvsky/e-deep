import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/shared/lib/classNames';
import type { SiteZone } from '@/shared/model/site';
import { ZONE_LABELS } from '../../lib/siteList';
import styles from './ZoneChips.module.scss';

export interface ZoneChipsProps {
  /** Zones that have sites, with their counts. */
  zones: readonly { zone: SiteZone; count: number }[];
  total: number;
  /** `null`: « Tous ». */
  value: SiteZone | null;
  onChange: (zone: SiteZone | null) => void;
}

const NEXT: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * Zone chips over the map (sites.jsx · RegionChips): a radio group, « Tous · 23 » then the zones
 * that have sites; choosing one frames its sites. Arrows move the choice, Tab leaves the group.
 */
export function ZoneChips({ zones, total, value, onChange }: ZoneChipsProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const options = [
    { zone: null, label: 'Tous', count: total },
    ...zones.map(({ zone, count }) => ({ zone, label: ZONE_LABELS[zone], count })),
  ];
  const checkedIndex = Math.max(
    0,
    options.findIndex((option) => option.zone === value),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = NEXT[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = (checkedIndex + step + options.length) % options.length;
    const option = options[index];
    if (!option) return;
    onChange(option.zone);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Zone de la carte"
      className={styles.group}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const isChecked = index === checkedIndex;
        return (
          <button
            key={option.zone ?? 'all'}
            type="button"
            role="radio"
            aria-checked={isChecked}
            tabIndex={isChecked ? 0 : -1}
            className={cx(styles.chip, isChecked && styles.checked)}
            onClick={() => onChange(option.zone)}
          >
            {option.label}
            <span className={styles.count}>{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}
