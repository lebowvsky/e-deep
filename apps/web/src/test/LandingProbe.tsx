import { useLocation } from 'react-router';
import { isRecord } from '@/shared/lib/guards';

/** The landing page of the account screens' tests: its title, and the notice of its route state. */
export function LandingProbe() {
  const state: unknown = useLocation().state;
  return (
    <>
      <h1>Accueil</h1>
      {isRecord(state) && typeof state.notice === 'string' && <p>{state.notice}</p>}
    </>
  );
}
