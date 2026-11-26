import { LogOut } from 'lucide-react';
import { useFetcher } from 'react-router';
import { Button } from '@/components/ui/button';
import { LOGOUT_PATH } from '../access-control/safeNext';
import { isLogoutFailure } from '../authRoutes';

/**
 * Posts to the `/logout` action, which closes the session then leads to `/login`. A fetcher, not a
 * navigation: when the API cannot be reached, the page stays and says so.
 */
export function LogoutButton() {
  const fetcher = useFetcher({ key: 'logout' });
  const isPending = fetcher.state !== 'idle';
  const hasFailed = fetcher.state === 'idle' && isLogoutFailure(fetcher.data);

  return (
    <fetcher.Form
      method="post"
      action={LOGOUT_PATH}
      lang="fr"
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        // Already signing out: a second click sends nothing.
        if (isPending) event.preventDefault();
      }}
    >
      <Button
        type="submit"
        variant="outline"
        className="min-h-11 md:min-h-9"
        aria-disabled={isPending || undefined}
      >
        <LogOut aria-hidden="true" />
        {isPending ? 'Déconnexion…' : 'Se déconnecter'}
      </Button>
      {hasFailed && (
        <p role="alert" className="text-sm text-destructive">
          La déconnexion a échoué. Réessayez.
        </p>
      )}
    </fetcher.Form>
  );
}
