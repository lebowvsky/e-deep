import type { ComponentProps } from 'react';
import { useFetcher } from 'react-router';
import { LOGOUT_FETCHER_KEY } from '../../logoutRoute';
import styles from './LogoutButton.module.scss';

export type LogoutButtonProps = Omit<ComponentProps<'button'>, 'type' | 'form'>;

/**
 * Signs out by posting to the `/logout` action (D41), from wherever it sits (user menu, drawer).
 * A fetcher rather than a navigation: when the API cannot be reached, the page stays as it is and
 * `useLogoutFeedback` says so. While the sign-out runs, another click submits nothing.
 */
export function LogoutButton({ onClick, ...rest }: LogoutButtonProps) {
  const fetcher = useFetcher({ key: LOGOUT_FETCHER_KEY });
  const isPending = fetcher.state !== 'idle';

  return (
    <fetcher.Form method="post" action="/logout" className={styles.form}>
      <button
        type="submit"
        aria-disabled={isPending || undefined}
        onClick={(event) => {
          if (isPending) event.preventDefault();
          onClick?.(event);
        }}
        {...rest}
      />
    </fetcher.Form>
  );
}
