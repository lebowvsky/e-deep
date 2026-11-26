import { Navigate, useLocation, useNavigate, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { isApiHttpError } from '@/shared/lib/apiClient';
import { FORBIDDEN_PATH, loginPath } from '../access-control/safeNext';

/**
 * Error element of the routes: a loader that could not check the session (network, 5xx), or a page
 * that crashed. A session lost or refused on the way is not an error: to `/login` or `/forbidden`.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const here = `${pathname}${search}${hash}`;

  if (isApiHttpError(error, 401)) return <Navigate to={loginPath(here)} replace />;
  if (isApiHttpError(error, 403)) return <Navigate to={FORBIDDEN_PATH} replace />;

  return (
    <main lang="fr" className="grid min-h-dvh place-items-center px-4 py-10">
      <title>Erreur · E-Deep Admin</title>
      <div className="flex max-w-md flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Une erreur est survenue</h1>
        <p className="text-muted-foreground">
          La page n’a pas pu s’afficher. Réessayez dans un instant.
        </p>
        <div>
          {/* Same page again: its loaders run anew and the error is reset. */}
          <Button
            className="min-h-11 md:min-h-9"
            onClick={() => void navigate(here, { replace: true })}
          >
            Réessayer
          </Button>
        </div>
      </div>
    </main>
  );
}
