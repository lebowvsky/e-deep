import { ButtonLink } from '@/shared/ui/Button';
import { PlaceholderPage } from './PlaceholderPage';

export interface LegalPlaceholderPageProps {
  title: string;
  message?: string;
}

/** A legal page of the footer (mentions, privacy, terms, contact), until its text is written. */
export function LegalPlaceholderPage({ title, message }: LegalPlaceholderPageProps) {
  return (
    <PlaceholderPage
      title={title}
      {...(message === undefined ? {} : { message })}
      actions={
        <ButtonLink to="/" icon="chevronLeft">
          Retour à l’accueil
        </ButtonLink>
      }
    />
  );
}
