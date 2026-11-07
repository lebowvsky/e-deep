/** Sparkline viewBox (unitless; the SVG stretches to its box). */
export const SPARK_WIDTH = 120;
export const SPARK_HEIGHT = 30;
const INSET = 4; // keeps the stroke inside the viewBox

/** SVG path of a series in the sparkline viewBox; empty when there are fewer than 2 points. */
export function sparklinePath(values: readonly number[]): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const step = SPARK_WIDTH / (values.length - 1);
  return values
    .map((value, index) => {
      const y = SPARK_HEIGHT - INSET - ((value - min) / range) * (SPARK_HEIGHT - 2 * INSET);
      return `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Running total of a series: [2, 4, 7] → [2, 6, 13]. */
export function cumulative(values: readonly number[]): number[] {
  let total = 0;
  return values.map((value) => (total += value));
}
