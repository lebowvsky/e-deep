import { useLogoutFeedback, LogoutButton } from '@/app/layout/LogoutButton';
import { OnboardingForm } from '@/features/auth/components/OnboardingForm';
import { AuthScreen } from '@/features/auth/components/AuthScreen';
import { pageTitle } from '@/shared/config/app';
import { useMe } from '@/shared/session/hooks/useMe';

/**
 * `/welcome`, the first launch (docs/plans/auth-screens.md §2): reached by a session whose profile
 * is to complete (`requireOnboardingStep`), outside the app frame.
 */
export function WelcomePage() {
  const { diver, currentPolicyVersion } = useMe();
  useLogoutFeedback();
  return (
    <AuthScreen
      variant="onboarding"
      title={`Bienvenue, ${diver.firstName}`}
      subtitle="Deux infos et ton carnet est prêt."
      footer={
        <>
          Ce n’est pas toi ?{' '}
          <LogoutButton>
            {(isPending) => (isPending ? 'Déconnexion…' : 'Se déconnecter')}
          </LogoutButton>
        </>
      }
    >
      <title>{pageTitle('Bienvenue')}</title>
      <OnboardingForm policyVersion={currentPolicyVersion} />
    </AuthScreen>
  );
}
