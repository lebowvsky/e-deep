import styles from './ResponsiveText.module.scss';

/** A label that has a shorter form on phones (mockup 04 vs 01). */
export type ResponsiveLabel = string | { short: string; long: string };

export interface ResponsiveTextProps {
  text: ResponsiveLabel;
}

/** Renders `short` below 768px and `long` above; the hidden one is `display: none` (not read). */
export function ResponsiveText({ text }: ResponsiveTextProps) {
  if (typeof text === 'string') return text;
  return (
    <>
      <span className={styles.short}>{text.short}</span>
      <span className={styles.long}>{text.long}</span>
    </>
  );
}
