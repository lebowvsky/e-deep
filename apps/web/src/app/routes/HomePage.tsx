import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { breakpoint } from '@/design/tokens';
import { AuthCard } from '@/features/auth/components/AuthCard';
import type { AuthTab } from '@/features/auth/types';
import { FeaturesSection } from '@/features/home/components/FeaturesSection';
import { FinalCta } from '@/features/home/components/FinalCta';
import { HeroSection } from '@/features/home/components/HeroSection';
import { ProductPreview } from '@/features/home/components/ProductPreview';
import { StepsSection } from '@/features/home/components/StepsSection';
import { APP_NAME, pageTitle } from '@/shared/config/app';
import { useAppConfig } from '@/shared/config/appConfigContext';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { ButtonLink } from '@/shared/ui/Button';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
import styles from './HomePage.module.scss';

const DESKTOP_UP = `(min-width: ${breakpoint.desktop}px)`;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const TITLES = {
  landing: `${APP_NAME} — Ton carnet de plongée numérique`,
  login: pageTitle('Connexion'),
  signup: pageTitle('Créer un compte'),
} as const;

/** A call to action asked for the card on this tab (`id`: each request is served once). */
interface CardRequest {
  tab: AuthTab;
  id: number;
}

/**
 * The public entry: `/` (landing), `/login` and `/signup`, one route element that stays mounted
 * from one to the other, so the e-mail typed survives a change of tab or of screen.
 *
 * ≥ 1024px: the landing page with the authentication card in its hero. Below: the landing page
 * with its two ways in on `/`, a dedicated screen on `/login` and `/signup`. The DOM differs
 * (title, landmarks, tabs or not), hence `useMediaQuery` (exception listed in apps/web/CLAUDE.md).
 */
export function HomePage() {
  const { pathname } = useLocation();
  const { features } = useAppConfig();
  const isDesktop = useMediaQuery(DESKTOP_UP);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION);
  const [email, setEmail] = useState('');
  const [cardRequest, setCardRequest] = useState<CardRequest | null>(null);
  const servedRequest = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const tab: AuthTab = pathname === '/signup' ? 'signup' : 'login';
  const isAuthPage = pathname !== '/';

  // The final call to action: once its tab shows, the card comes back into view and its first
  // field takes the focus (DOM scroll and focus: the effect's external system).
  useEffect(() => {
    if (cardRequest === null || cardRequest.tab !== tab) return;
    if (servedRequest.current === cardRequest.id) return;
    servedRequest.current = cardRequest.id;
    const card = cardRef.current;
    card?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    card?.querySelector('input')?.focus({ preventScroll: true });
  }, [cardRequest, tab, prefersReducedMotion]);

  if (!isDesktop && isAuthPage) {
    return tab === 'signup' ? (
      <SignupPage email={email} onEmailChange={setEmail} />
    ) : (
      <LoginPage email={email} onEmailChange={setEmail} />
    );
  }

  return (
    <PublicLayout landing>
      <title>{TITLES[isAuthPage ? tab : 'landing']}</title>
      <HeroSection
        aside={
          isDesktop && (
            <div ref={cardRef} className={styles.card}>
              <AuthCard tab={tab} email={email} onEmailChange={setEmail} autoFocus={isAuthPage} />
            </div>
          )
        }
        actions={
          !isDesktop &&
          (features.signup ? (
            <>
              <ButtonLink to="/signup" variant="primary" size="xl">
                Créer mon carnet
              </ButtonLink>
              <ButtonLink to="/login" size="xl">
                J’ai déjà un compte
              </ButtonLink>
            </>
          ) : (
            <ButtonLink to="/login" variant="primary" size="xl">
              Se connecter
            </ButtonLink>
          ))
        }
      />
      <ProductPreview />
      <StepsSection />
      <FeaturesSection />
      <FinalCta
        {...(isDesktop
          ? {
              onChoose: (choice: AuthTab) =>
                setCardRequest((previous) => ({ tab: choice, id: (previous?.id ?? 0) + 1 })),
            }
          : {})}
      />
    </PublicLayout>
  );
}
