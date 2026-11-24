import { useState } from 'react';
import { useLocation } from 'react-router';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { breakpoint } from '@/design/tokens';
import { AuthCard } from '@/features/auth/components/AuthCard';
import type { AuthTab } from '@/features/auth/types';
import { APP_NAME } from '@/shared/config/app';
import { useAppConfig } from '@/shared/config/appConfigContext';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { ButtonLink } from '@/shared/ui/Button';
import { LoginPage } from './LoginPage';
import { PlaceholderPage } from './PlaceholderPage';
import { SignupPage } from './SignupPage';

const DESKTOP_UP = `(min-width: ${breakpoint.desktop}px)`;

const SIGNUP_CLOSED = 'Inscriptions bientôt ouvertes.';

const INTRO = `${APP_NAME} remplace le carnet papier : saisis ta plongée en une minute après la sortie, retrouve-la en deux clics, et suis ta progression plongée après plongée.`;

/**
 * The public entry: `/` (landing), `/login` and `/signup`, one route element that stays mounted
 * from one to the other, so the e-mail typed survives a change of tab or of screen.
 *
 * ≥ 1024px: the landing page with the authentication card. Below: the landing page alone on `/`,
 * a dedicated screen on `/login` and `/signup`. The DOM differs (title, landmarks, tabs or not),
 * hence `useMediaQuery` (exception listed in apps/web/CLAUDE.md). The landing content itself is a
 * placeholder until lot 6a, phase 3.
 */
export function HomePage() {
  const { pathname } = useLocation();
  const { features } = useAppConfig();
  const isDesktop = useMediaQuery(DESKTOP_UP);
  const [email, setEmail] = useState('');
  const tab: AuthTab = pathname === '/signup' ? 'signup' : 'login';
  const isAuthPage = pathname !== '/';

  if (!isDesktop && isAuthPage) {
    return tab === 'signup' ? (
      <SignupPage email={email} onEmailChange={setEmail} />
    ) : (
      <LoginPage email={email} onEmailChange={setEmail} />
    );
  }

  return (
    <PublicLayout>
      <PlaceholderPage
        title="Toutes tes plongées, dans un seul carnet."
        message={features.signup ? INTRO : `${INTRO} ${SIGNUP_CLOSED}`}
        actions={
          isDesktop ? null : features.signup ? (
            <>
              <ButtonLink to="/signup" variant="primary">
                Créer mon carnet
              </ButtonLink>
              <ButtonLink to="/login">J’ai déjà un compte</ButtonLink>
            </>
          ) : (
            <ButtonLink to="/login" variant="primary">
              Se connecter
            </ButtonLink>
          )
        }
      />
      {isDesktop && (
        <AuthCard tab={tab} email={email} onEmailChange={setEmail} autoFocus={isAuthPage} />
      )}
    </PublicLayout>
  );
}
