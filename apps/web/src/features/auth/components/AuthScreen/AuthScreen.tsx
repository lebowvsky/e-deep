import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { APP_NAME } from '@/shared/config/app';
import { cx } from '@/shared/lib/classNames';
import { LogoMark } from '@/shared/ui/Brand';
import { Icon } from '@/shared/ui/Icon';
import styles from './AuthScreen.module.scss';

export interface AuthScreenProps {
  title: string;
  subtitle: string;
  /** The form. */
  children: ReactNode;
  /** Under the form: the way to the other screen (« Pas encore de compte ? … »), or out. */
  footer: ReactNode;
  /**
   * `entry`: sign-in and sign-up below 1024px, « ‹ Accueil » above the logo. `onboarding`
   * (`/welcome`, `/consent`, every width): the brand on top, no way back (the landing page would
   * send a signed-in diver back here), the page in a centred card from the tablet.
   */
  variant?: 'entry' | 'onboarding';
}

/**
 * Dedicated auth screen (welcome.jsx · LoginMobile): the title of the page, the form, then the way
 * to the other screen.
 *
 * On arrival the focus goes to the page, not to a field: a field would open the phone's keyboard
 * over the screen before it is read. A screen reader starts from the title.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
  variant = 'entry',
}: AuthScreenProps) {
  const mainRef = useRef<HTMLElement>(null);
  const isOnboarding = variant === 'onboarding';

  // Focus moved once the screen is shown (DOM focus: the effect's external system).
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={cx(styles.screen, isOnboarding && styles.onboarding)}>
      <header className={styles.header}>
        {isOnboarding ? (
          <span className={styles.brand}>
            <LogoMark size="md" />
            {APP_NAME}
          </span>
        ) : (
          <Link to="/" className={styles.back}>
            <Icon name="chevronLeft" size="xl" />
            Accueil
          </Link>
        )}
      </header>
      <main ref={mainRef} id="main-content" className={styles.content} tabIndex={-1}>
        {!isOnboarding && <LogoMark size="lg" />}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.form}>{children}</div>
        <p className={styles.footer}>{footer}</p>
      </main>
    </div>
  );
}
