import { useState } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { TextInput, type TextInputProps } from '@/shared/ui/TextInput';
import styles from './PasswordField.module.scss';

export interface PasswordFieldProps extends Omit<TextInputProps, 'type' | 'end' | 'autoComplete'> {
  /** `current-password` to sign in, `new-password` to sign up (password managers rely on it). */
  autoComplete: 'current-password' | 'new-password';
}

/**
 * Password input with its show / hide toggle (welcome.jsx · EyeBtn): a real button, whose name
 * stays the same and whose state is `aria-pressed`. Place it in a `FormField`.
 */
export function PasswordField(props: PasswordFieldProps) {
  const [isShown, setIsShown] = useState(false);
  return (
    <TextInput
      {...props}
      type={isShown ? 'text' : 'password'}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      end={
        <IconButton
          icon={isShown ? 'eyeOff' : 'eye'}
          label="Afficher le mot de passe"
          aria-pressed={isShown}
          className={styles.toggle}
          onClick={() => setIsShown((shown) => !shown)}
        />
      }
    />
  );
}
