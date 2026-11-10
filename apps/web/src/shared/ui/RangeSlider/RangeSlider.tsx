import type { ChangeEvent, CSSProperties } from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './RangeSlider.module.scss';

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: readonly [number, number];
  onChange: (value: [number, number]) => void;
  /** Accessible names of the two handles. */
  labels: readonly [string, string];
  /** Spoken value of a handle: 20 → « 20 mètres ». */
  formatValueText: (value: number) => string;
  /** Visible scale under the rail (« 0 m », « 20 », …). */
  ticks?: readonly string[];
  className?: string | undefined;
}

/**
 * Two-handle range slider (dives-list.jsx · Profondeur max). Two native range inputs stacked on
 * one rail: keyboard, touch and screen readers work as for any slider. The handles never cross.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  labels,
  formatValueText,
  ticks,
  className,
}: RangeSliderProps) {
  const [low, high] = value;
  const percent = (point: number) => ((point - min) / (max - min)) * 100;
  // Data-driven position of the filled segment: the only inline style (custom properties).
  const fill = {
    '--range-from': `${percent(low)}%`,
    '--range-to': `${percent(high)}%`,
  } as CSSProperties;

  const onLow = (event: ChangeEvent<HTMLInputElement>) =>
    onChange([Math.min(Number(event.target.value), high), high]);
  const onHigh = (event: ChangeEvent<HTMLInputElement>) =>
    onChange([low, Math.max(Number(event.target.value), low)]);

  return (
    <div className={cx(styles.slider, className)}>
      <div className={styles.rail} style={fill}>
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={onLow}
          aria-label={labels[0]}
          aria-valuetext={formatValueText(low)}
        />
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={onHigh}
          aria-label={labels[1]}
          aria-valuetext={formatValueText(high)}
        />
      </div>
      {ticks && (
        <div className={styles.ticks} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      )}
    </div>
  );
}
