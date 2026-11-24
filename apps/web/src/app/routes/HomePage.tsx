import { useLocation } from 'react-router';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { APP_NAME } from '@/shared/config/app';
import { useAppConfig } from '@/shared/config/appConfigContext';
import { ButtonLink } from '@/shared/ui/Button';
import { PlaceholderPage } from './PlaceholderPage';

const SIGNUP_CLOSED = 'Inscriptions bientôt ouvertes.';

/**
 * The public entry: `/` (landing), `/login` and `/signup`, one route element that stays mounted
 * from one to the other. Placeholder content until the landing page and the forms arrive (lot 6a,
 * phases 2 to 4); the routing and the redirections are the final ones.
 */
export function HomePage() {
  const { pathname, search } = useLocation();
  const { features } = useAppConfig();

  if (pathname === '/login') {
    return (
      <PublicLayout>
        <PlaceholderPage
          title="Connexion"
          message={
            features.signup
              ? 'Le formulaire de connexion arrive bientôt.'
              : `Le formulaire de connexion arrive bientôt. ${SIGNUP_CLOSED}`
          }
          actions={
            <>
              <ButtonLink to="/forgot-password">Mot de passe oublié ?</ButtonLink>
              {features.signup && <ButtonLink to={`/signup${search}`}>Créer mon carnet</ButtonLink>}
            </>
          }
        />
      </PublicLayout>
    );
  }

  if (pathname === '/signup') {
    return (
      <PublicLayout>
        <PlaceholderPage
          title="Inscription"
          message="Le formulaire d’inscription arrive bientôt."
          actions={<ButtonLink to={`/login${search}`}>J’ai déjà un compte</ButtonLink>}
        />
      </PublicLayout>
    );
  }

  const intro = `${APP_NAME} remplace le carnet papier : saisis ta plongée en une minute après la sortie, retrouve-la en deux clics, et suis ta progression plongée après plongée.`;
  return (
    <PublicLayout>
      <PlaceholderPage
        title="Toutes tes plongées, dans un seul carnet."
        message={features.signup ? intro : `${intro} ${SIGNUP_CLOSED}`}
        actions={
          features.signup ? (
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
    </PublicLayout>
  );
}
