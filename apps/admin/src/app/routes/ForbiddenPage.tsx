import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '../layout/LogoutButton';

/**
 * `/forbidden`: a signed-in staff member whose role does not open the page asked for. Outside of
 * the protected layout, so that a session the API refuses outright still has a way out.
 */
export function ForbiddenPage() {
  return (
    <main lang="fr" className="grid min-h-dvh place-items-center px-4 py-10">
      <title>Accès refusé · E-Deep Admin</title>
      <div className="flex max-w-md flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Accès refusé</h1>
        <p className="text-muted-foreground">
          Votre compte n’a pas les droits nécessaires pour ouvrir cette page.
        </p>
        <div className="flex flex-wrap items-start justify-center gap-3">
          <Button asChild className="min-h-11 md:min-h-9">
            <Link to="/">Retour à l’accueil</Link>
          </Button>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
