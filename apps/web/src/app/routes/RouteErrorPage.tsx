import { Navigate, useLocation, useNavigate, useRouteError } from 'react-router';
import { sessionEventOf } from '@/shared/session/lib/sessionErrors';
import { loginPath } from '@/shared/session/lib/sessionPaths';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { PlaceholderPage } from './PlaceholderPage';

/**
 * Error element of the session routes: a loader that could not check the session (network, 5xx),
 * or a page that crashed. A session lost on the way is not an error: to the login page.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const here = `${pathname}${search}${hash}`;

  if (sessionEventOf(error) === 'unauthenticated') {
    return <Navigate to={loginPath(here)} replace />;
  }
  return (
    <main id="main-content">
      <PlaceholderPage
        title="Une erreur est survenue"
        message="La page n’a pas pu s’afficher. Réessaie dans un instant."
        actions={
          <>
            {/* Same page again: its loaders run anew and the error is reset. */}
            <Button variant="primary" onClick={() => void navigate(here, { replace: true })}>
              Réessayer
            </Button>
            <ButtonLink to="/dashboard" icon="dashboard">
              Retour au tableau de bord
            </ButtonLink>
          </>
        }
      />
    </main>
  );
}
