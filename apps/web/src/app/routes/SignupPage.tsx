import { Link, useLocation } from 'react-router';
import { AuthScreen } from '@/features/auth/components/AuthScreen';
import { SignupForm } from '@/features/auth/components/SignupForm';
import { pageTitle } from '@/shared/config/app';

export interface SignupPageProps {
  email: string;
  onEmailChange: (email: string) => void;
}

/** Sign-up screen below 1024px (capture 53's frame, form of 51); its e-mail is kept by `HomePage`. */
export function SignupPage({ email, onEmailChange }: SignupPageProps) {
  const { search } = useLocation();
  return (
    <AuthScreen
      title="Ouvre ton carnet"
      subtitle="Une minute, et ton carnet est prêt."
      footer={
        <>
          Déjà un compte ? <Link to={`/login${search}`}>Se connecter</Link>
        </>
      }
    >
      <title>{pageTitle('Créer un compte')}</title>
      <SignupForm email={email} onEmailChange={onEmailChange} />
    </AuthScreen>
  );
}
