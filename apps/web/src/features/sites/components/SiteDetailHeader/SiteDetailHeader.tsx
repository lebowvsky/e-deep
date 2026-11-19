import { Link, useNavigate } from 'react-router';
import type { Site } from '@/shared/model/site';
import { SITE_TYPE_LABELS } from '@/shared/sites/lib/labels';
import { ButtonLink } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Overline } from '@/shared/ui/Overline';
import { editHrefOf, mapHrefOf, newDiveHrefOf } from '../../lib/labels';
import { ZONE_LABELS } from '../../lib/siteList';
import { SiteActionsMenu } from '../SiteActionsMenu';
import styles from './SiteDetailHeader.module.scss';

export interface SiteDetailHeaderProps {
  site: Site;
  onMerge: () => void;
  onDelete: () => void;
}

/**
 * Top of the site page (sites.jsx · SiteDetailDesktop / SiteDetailMobile): « ‹ Carte / nom »
 * (a top bar with « … » on phones), eyebrow, name, region, and the actions.
 */
export function SiteDetailHeader({ site, onMerge, onDelete }: SiteDetailHeaderProps) {
  const navigate = useNavigate();
  const eyebrow = ['Site', site.type && SITE_TYPE_LABELS[site.type], 'privé']
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <nav className={styles.bar} aria-label="Fil d’Ariane">
        <Link to={mapHrefOf(site.id)} className={styles.back}>
          <Icon name="chevronLeft" size="md" />
          Carte
        </Link>
        <span className={styles.trail} aria-hidden="true">
          /
        </span>
        <span className={styles.trail} aria-current="page">
          {site.name}
        </span>
      </nav>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Overline tone="accent" as="p">
            {eyebrow}
          </Overline>
          <h1 className={styles.title}>{site.name}</h1>
          {(site.region || site.zone !== 'autre') && (
            <p className={styles.place}>
              {site.region}
              {site.zone !== 'autre' && (
                <span className={styles.zone}>
                  {site.region && ' · '}
                  {ZONE_LABELS[site.zone]}
                </span>
              )}
            </p>
          )}
        </div>
        <div className={styles.actions}>
          <ButtonLink to={newDiveHrefOf(site.id)} icon="plus" className={styles.wideOnly}>
            Nouvelle plongée ici
          </ButtonLink>
          <ButtonLink to={editHrefOf(site.id)} icon="pencil" className={styles.wideOnly}>
            Modifier
          </ButtonLink>
          <SiteActionsMenu
            className={styles.menu}
            actions={[
              {
                id: 'edit',
                label: 'Modifier',
                icon: 'pencil',
                phoneOnly: true,
                onSelect: () => void navigate(editHrefOf(site.id)),
              },
              {
                id: 'merge',
                label: 'Fusionner avec un autre site…',
                icon: 'merge',
                onSelect: onMerge,
              },
              {
                id: 'delete',
                label: 'Supprimer le site',
                icon: 'close',
                tone: 'danger',
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </header>
    </>
  );
}
