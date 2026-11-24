import type { ReactNode } from 'react';
import { PublicFooter } from '@/features/home/components/PublicFooter';
import { PublicHeader } from '@/features/home/components/PublicHeader';
import { cx } from '@/shared/lib/classNames';
import styles from './PublicLayout.module.scss';

export interface PublicLayoutProps {
  children: ReactNode;
  /**
   * The landing page: full-width sections, the header's anchors, its own background. Otherwise a
   * single readable column (placeholders, legal pages).
   */
  landing?: boolean;
}

/** Frame of the public pages (D45), without the app's sidebar: header, page, legal links. */
export function PublicLayout({ children, landing = false }: PublicLayoutProps) {
  return (
    <div className={cx(styles.page, landing && styles.landing)}>
      <a className={styles.skipLink} href="#main-content">
        Aller au contenu
      </a>
      <PublicHeader anchors={landing} />
      <main id="main-content" className={cx(styles.main, !landing && styles.column)}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
