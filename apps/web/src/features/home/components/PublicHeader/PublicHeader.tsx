import { Link } from 'react-router';
import { useAppConfig } from '@/shared/config/appConfigContext';
import { cx } from '@/shared/lib/classNames';
import { Brand } from '@/shared/ui/Brand';
import { LANDING_ANCHORS } from '../../content';
import styles from './PublicHeader.module.scss';

export interface PublicHeaderProps {
  /** The landing page: anchors to its sections (≥ 1024px), the card being the way in. */
  anchors?: boolean;
}

/**
 * Header of the public pages (welcome.jsx): the brand back home; on the landing page, its anchors
 * (« Confidentialité » only with a privacy promise), elsewhere and on phones « Se connecter ».
 */
export function PublicHeader({ anchors = false }: PublicHeaderProps) {
  const { privacy } = useAppConfig();
  const links = [
    { id: LANDING_ANCHORS.steps, label: 'Comment ça marche' },
    { id: LANDING_ANCHORS.features, label: 'Fonctionnalités' },
    ...(privacy.copy === null ? [] : [{ id: LANDING_ANCHORS.privacy, label: 'Confidentialité' }]),
  ];

  return (
    <header className={styles.header}>
      <Brand to="/" />
      {anchors && (
        <nav aria-label="Sur cette page" className={styles.anchors}>
          <ul className={styles.list}>
            {links.map((link) => (
              <li key={link.id}>
                <a href={`#${link.id}`} className={styles.anchor}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Link to="/login" className={cx(styles.login, anchors && styles.loginPhoneOnly)}>
        Se connecter
      </Link>
    </header>
  );
}
