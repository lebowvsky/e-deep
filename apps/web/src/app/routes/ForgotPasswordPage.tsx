import { BETA_CONTACT_MESSAGE } from '@/shared/config/publicPages';
import { ButtonLink } from '@/shared/ui/Button';
import { PlaceholderPage } from './PlaceholderPage';

/** « Mot de passe oublié ? »: no e-mail in the closed beta (D39), so a person resets it. */
export function ForgotPasswordPage() {
  return (
    <PlaceholderPage
      title="Mot de passe oublié"
      message={`La réinitialisation en ligne arrive bientôt. ${BETA_CONTACT_MESSAGE}`}
      actions={
        <ButtonLink to="/login" icon="chevronLeft">
          Retour à la connexion
        </ButtonLink>
      }
    />
  );
}
