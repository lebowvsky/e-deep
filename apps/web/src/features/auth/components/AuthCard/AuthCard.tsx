import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAppConfig } from '@/shared/config/appConfigContext';
import { Card } from '@/shared/ui/Card';
import { AUTH_PATHS, authTabId, type AuthTab } from '../../types';
import { AuthTabs } from '../AuthTabs';
import { LoginForm } from '../LoginForm';
import { SignupForm } from '../SignupForm';
import styles from './AuthCard.module.scss';

export interface AuthCardProps {
  /** The tab of the page (`/` and `/login`: sign-in, `/signup`: sign-up). */
  tab: AuthTab;
  email: string;
  onEmailChange: (email: string) => void;
  /** Focus the first field on arrival (`/login`, `/signup`), not after a change of tab. */
  autoFocus?: boolean;
}

const HEADINGS = {
  login: { title: 'Content de te revoir', subtitle: 'Reprends ton carnet là où tu l’as laissé.' },
  signup: { title: 'Ouvre ton carnet', subtitle: 'Une minute, et ton carnet est prêt.' },
} as const satisfies Record<AuthTab, { title: string; subtitle: string }>;

/**
 * Authentication card of the landing page (welcome.jsx · AuthCard, ≥ 1024px): its tabs change the
 * URL (`/login` ↔ `/signup`, `next` kept) without leaving the page, and the e-mail typed stays.
 * While the beta is closed (`features.signup`), sign-in only, and a word on the sign-up.
 */
export function AuthCard({ tab, email, onEmailChange, autoFocus = false }: AuthCardProps) {
  const { features } = useAppConfig();
  const navigate = useNavigate();
  const { search } = useLocation();
  const idPrefix = useId();
  const panelId = `${idPrefix}-panel`;
  const [hasSwitched, setHasSwitched] = useState(false);
  const shown: AuthTab = features.signup ? tab : 'login';
  const { title, subtitle } = HEADINGS[shown];

  const select = (next: AuthTab) => {
    setHasSwitched(true);
    void navigate(
      { pathname: AUTH_PATHS[next], search },
      { replace: true, preventScrollReset: true },
    );
  };

  const form =
    shown === 'login' ? (
      <LoginForm
        key="login"
        email={email}
        onEmailChange={onEmailChange}
        autoFocus={autoFocus && !hasSwitched}
      />
    ) : (
      <SignupForm
        key="signup"
        email={email}
        onEmailChange={onEmailChange}
        autoFocus={autoFocus && !hasSwitched}
      />
    );

  return (
    <Card elevation={2} padding="none" className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      {features.signup ? (
        <>
          <AuthTabs tab={shown} onSelect={select} panelId={panelId} idPrefix={idPrefix} />
          <div id={panelId} role="tabpanel" aria-labelledby={authTabId(idPrefix, shown)}>
            {form}
          </div>
        </>
      ) : (
        <>
          {form}
          <p className={styles.note}>Inscriptions bientôt ouvertes.</p>
        </>
      )}
    </Card>
  );
}
