import { Link, useLocation } from 'react-router';
import { AuthScreen } from '@/features/auth/components/AuthScreen';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { pageTitle } from '@/shared/config/app';
import { useAppConfig } from '@/shared/config/appConfigContext';

export interface LoginPageProps {
  email: string;
  onEmailChange: (email: string) => void;
}

/** Sign-in screen below 1024px (capture 53); its e-mail is kept by `HomePage`. */
export function LoginPage({ email, onEmailChange }: LoginPageProps) {
  const { features } = useAppConfig();
  const { search } = useLocation();
  return (
    <AuthScreen
      title="Content de te revoir"
      subtitle="Reprends ton carnet là où tu l’as laissé."
      footer={
        features.signup ? (
          <>
            Pas encore de compte ? <Link to={`/signup${search}`}>Créer mon carnet</Link>
          </>
        ) : (
          'Inscriptions bientôt ouvertes.'
        )
      }
    >
      <title>{pageTitle('Connexion')}</title>
      <LoginForm email={email} onEmailChange={onEmailChange} />
    </AuthScreen>
  );
}
