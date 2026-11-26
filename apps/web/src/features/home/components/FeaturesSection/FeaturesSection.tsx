import { useId } from 'react';
import { useAppConfig } from '@/shared/config/appConfigContext';
import { Icon } from '@/shared/ui/Icon';
import { LANDING_ANCHORS, landingContent } from '../../content';
import { SectionHeading } from '../SectionHeading';
import styles from './FeaturesSection.module.scss';

/**
 * « Fonctionnalités » (welcome.jsx): only the promises the product keeps (`features.offline`,
 * `privacy.copy`, D45). Desktop: a 3-column grid with hairlines, 2 columns for 4 promises, the last
 * cell spanning 2 columns for 5; phones: cards.
 */
export function FeaturesSection() {
  const titleId = useId();
  const { features } = landingContent(useAppConfig());

  return (
    <section id={LANDING_ANCHORS.features} className={styles.section} aria-labelledby={titleId}>
      <SectionHeading
        id={titleId}
        overline="Fonctionnalités"
        title="Pensé par et pour des plongeurs"
        subtitle="Pas de gadget : ce qu’on note dans un carnet, en plus lisible."
      />
      <ul className={styles.grid} data-count={features.length}>
        {features.map((feature) => (
          <li
            key={feature.id}
            id={feature.id === LANDING_ANCHORS.privacy ? feature.id : undefined}
            className={styles.cell}
          >
            <span className={styles.iconBox} aria-hidden="true">
              <Icon name={feature.icon} size="lg" />
            </span>
            <div>
              <h3 className={styles.title}>{feature.title}</h3>
              <p className={styles.text}>{feature.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
