import { useEffect, useEffectEvent } from 'react';

/** Ctrl + Entrée (⌘ + Entrée on a Mac) anywhere on the page: submits the form of the screen. */
export function useSubmitShortcut(onSubmit: () => void): void {
  const submit = useEffectEvent(onSubmit);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
      event.preventDefault();
      submit();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
