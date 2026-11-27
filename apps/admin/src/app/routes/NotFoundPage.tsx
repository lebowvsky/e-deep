import { Link } from 'react-router';

/** Any path no route declares, inside the protected layout. */
export function NotFoundPage() {
  return (
    <div lang="fr" className="mx-auto flex max-w-5xl flex-col gap-4">
      <title>Page introuvable · E-Deep Admin</title>
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="text-muted-foreground">Cette page n’existe pas.</p>
      <p>
        <Link to="/" className="font-medium underline underline-offset-4">
          Retour à l’accueil
        </Link>
      </p>
    </div>
  );
}
