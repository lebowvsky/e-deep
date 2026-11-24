import { useState, type ReactNode } from 'react';

export interface EmailProps {
  email: string;
  onEmailChange: (email: string) => void;
}

/** The page's role for an auth form: it keeps the e-mail (`renderAuthForm`). */
export function EmailHolder({ render }: { render: (props: EmailProps) => ReactNode }) {
  const [email, setEmail] = useState('');
  return render({ email, onEmailChange: setEmail });
}
