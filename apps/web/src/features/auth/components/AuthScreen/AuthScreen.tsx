import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { LogoMark } from '@/shared/ui/Brand';
import { Icon } from '@/shared/ui/Icon';
import styles from './AuthScreen.module.scss';

export interface AuthScreenProps {
  title: string;
  subtitle: string;
  /** The form. */
  children: ReactNode;
  /** Under the form: the way to the other screen (« Pas encore de compte ? … »). */
  footer: ReactNode;
}

/**
 * Dedicated sign-in or sign-up screen, below 1024px (welcome.jsx · LoginMobile): « ‹ Accueil »,
 * the logo, the title of the page, the form, then the way to the other screen.
 *
 * On arrival the focus goes to the page, not to a field: a field would open the phone's keyboard
 * over the screen before it is read. A screen reader starts from the title.
 */
export function AuthScreen({ title, subtitle, children, footer }: AuthScreenProps) {
  const mainRef = useRef<HTMLElement>(null);

  // Focus moved once the screen is shown (DOM focus: the effect's external system).
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          <Icon name="chevronLeft" size="xl" />
          Accueil
        </Link>
      </header>
      <main ref={mainRef} id="main-content" className={styles.content} tabIndex={-1}>
        <LogoMark size="lg" />
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.form}>{children}</div>
        <p className={styles.footer}>{footer}</p>
      </main>
    </div>
  );
}
