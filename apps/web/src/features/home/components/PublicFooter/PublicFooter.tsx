import { NavLink } from 'react-router';
import { LEGAL_PAGES } from '@/shared/config/publicPages';
import { cx } from '@/shared/lib/classNames';
import { Brand } from '@/shared/ui/Brand';
import { ResponsiveText } from '@/shared/ui/ResponsiveText';
import styles from './PublicFooter.module.scss';

/** Footer of the public pages (welcome.jsx): the brand, then the legal pages. */
export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <Brand to="/" size="sm" className={styles.brand} />
      <nav aria-label="Informations légales">
        <ul className={styles.links}>
          {LEGAL_PAGES.map((page) => (
            <li key={page.path}>
              <NavLink to={page.path} className={cx(styles.link)}>
                <ResponsiveText text={{ short: page.shortTitle, long: page.title }} />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
