import { useId, type ReactNode } from 'react';
import { APP_NAME } from '@/shared/config/app';
import { useAppConfig } from '@/shared/config/appConfigContext';
import { Icon } from '@/shared/ui/Icon';
import { Overline } from '@/shared/ui/Overline';
import { ResponsiveText } from '@/shared/ui/ResponsiveText';
import { LANDING_ANCHORS, landingContent } from '../../content';
import styles from './HeroSection.module.scss';

export interface HeroSectionProps {
  /** Right column (≥ 1024px): the authentication card. */
  aside?: ReactNode;
  /** Under the paragraph (phones and tablets): the ways in. */
  actions?: ReactNode;
}

/**
 * Top of the landing page (welcome.jsx · hero): what the product is, its promises (only those it
 * keeps, `landingContent`), and the way in given by the page.
 */
export function HeroSection({ aside, actions }: HeroSectionProps) {
  const titleId = useId();
  const { heroPoints } = landingContent(useAppConfig());

  return (
    <section className={styles.hero} aria-labelledby={titleId}>
      <div className={styles.intro}>
        <Overline tone="accent" as="p">
          <ResponsiveText
            text={{
              short: 'Carnet de plongée numérique',
              long: 'Carnet de plongée numérique · FFESSM · CMAS',
            }}
          />
        </Overline>
        <h1 id={titleId} className={styles.title}>
          Toutes tes plongées, dans un seul carnet.
        </h1>
        <p className={styles.lead}>
          <ResponsiveText
            text={{
              short:
                'Saisis ta plongée en une minute après la sortie, retrouve-la en deux clics, suis ta progression.',
              long: `${APP_NAME} remplace le carnet papier : saisis ta plongée en une minute après la sortie, retrouve-la en deux clics, et suis ta progression plongée après plongée.`,
            }}
          />
        </p>
        {actions && <div className={styles.actions}>{actions}</div>}
        <ul className={styles.points}>
          {heroPoints.map((point) => (
            <li key={point} className={styles.point}>
              <span className={styles.bullet} aria-hidden="true">
                <Icon name="check" size="xs" weight="bold" />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <a href={`#${LANDING_ANCHORS.preview}`} className={styles.scrollHint}>
          <span className={styles.rule} aria-hidden="true" />
          Découvre l’app plus bas
          <Icon name="chevronDown" size="md" />
        </a>
      </div>
      {aside && <div className={styles.aside}>{aside}</div>}
    </section>
  );
}
