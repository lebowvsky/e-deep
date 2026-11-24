import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { LEGAL_PAGES } from '@/shared/config/publicPages';
import { cx } from '@/shared/lib/classNames';
import { Brand } from '@/shared/ui/Brand';
import styles from './PublicLayout.module.scss';

export interface PublicLayoutProps {
  children: ReactNode;
}

/**
 * Frame of the public pages (D45), without the app's sidebar: the brand back to the landing page,
 * the page itself, and the legal links. Its header and footer get their final look with the
 * landing page (lot 6a, phase 3).
 */
export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        Aller au contenu
      </a>
      <header className={styles.header}>
        <Brand to="/" />
      </header>
      <main id="main-content" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <nav aria-label="Informations légales">
          <ul className={styles.links}>
            {LEGAL_PAGES.map((page) => (
              <li key={page.path}>
                <NavLink to={page.path} className={cx(styles.link)}>
                  {page.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}
