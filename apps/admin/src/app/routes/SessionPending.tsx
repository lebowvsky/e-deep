/** Shown while the session is checked, before the first page (`HydrateFallback`). */
export function SessionPending() {
  return (
    <main lang="fr" className="grid min-h-dvh place-items-center px-4">
      <p role="status" className="text-muted-foreground">
        Chargement…
      </p>
    </main>
  );
}
