import { Link } from 'react-router';
import { iconStroke } from '@/design/tokens';
import { APP_NAME } from '@/shared/config/app';
import { cx } from '@/shared/lib/classNames';
import styles from './Brand.module.scss';

export interface BrandProps {
  /** md: sidebar / drawer · sm: mobile top bar */
  size?: 'sm' | 'md';
  /** Where the brand leads: the dashboard in the app, the landing page on the public pages. */
  to?: string;
  className?: string | undefined;
}

/** Logo mark (two waves) + product name, as a link home. */
export function Brand({ size = 'md', to = '/dashboard', className }: BrandProps) {
  return (
    <Link to={to} className={cx(styles.brand, styles[size], className)}>
      <span className={styles.mark} aria-hidden="true">
        <svg
          className={styles.glyph}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={iconStroke.brand}
          strokeLinecap="round"
          focusable="false"
        >
          <path d="M2 6c1.5 0 1.5-1.2 3-1.2S6.5 6 8 6s1.5-1.2 3-1.2S12.5 6 14 6" />
          <path d="M2 10c1.5 0 1.5-1.2 3-1.2S6.5 10 8 10s1.5-1.2 3-1.2S12.5 10 14 10" />
        </svg>
      </span>
      <span className={styles.name}>{APP_NAME}</span>
    </Link>
  );
}
