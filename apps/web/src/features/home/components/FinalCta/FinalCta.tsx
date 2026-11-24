import { useId } from 'react';
import { useAppConfig } from '@/shared/config/appConfigContext';
import { cx } from '@/shared/lib/classNames';
import { ButtonLink } from '@/shared/ui/Button';
import styles from './FinalCta.module.scss';

/** The way in a call to action leads to (the sign-in or the sign-up tab of the card). */
export type AuthChoice = 'login' | 'signup';

export interface FinalCtaProps {
  /**
   * The page brings the authentication card back into view and opens this tab (desktop). Without
   * it, the links simply lead to the dedicated screens.
   */
  onChoose?: (choice: AuthChoice) => void;
}

/**
 * Last call to action of the landing page (welcome.jsx). While the beta is closed
 * (`features.signup`), « Se connecter » only, and the sign-up is announced.
 */
export function FinalCta({ onChoose }: FinalCtaProps) {
  const titleId = useId();
  const { features } = useAppConfig();
  const inPage = onChoose !== undefined;
  // In the page, the tab changes the URL without a new history entry, as the card's tabs do.
  const linkProps = (choice: AuthChoice) => ({
    to: `/${choice}`,
    size: 'lg' as const,
    replace: inPage,
    preventScrollReset: inPage,
    onClick: () => onChoose?.(choice),
  });

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.panel}>
        <div>
          <h2 id={titleId} className={styles.title}>
            Ta prochaine plongée mérite mieux qu’un post-it.
          </h2>
          {features.signup ? (
            <p className={cx(styles.subtitle, styles.subtitleDesktop)}>
              Crée ton carnet, et reporte tes anciennes plongées à ton rythme.
            </p>
          ) : (
            <p className={styles.subtitle}>Les inscriptions ouvrent bientôt.</p>
          )}
        </div>
        <div className={styles.actions}>
          {features.signup ? (
            <>
              <ButtonLink {...linkProps('login')} className={cx(styles.action, styles.desktopOnly)}>
                Se connecter
              </ButtonLink>
              <ButtonLink {...linkProps('signup')} variant="primary" className={styles.action}>
                Créer mon carnet
              </ButtonLink>
            </>
          ) : (
            <ButtonLink {...linkProps('login')} variant="primary" className={styles.action}>
              Se connecter
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}
