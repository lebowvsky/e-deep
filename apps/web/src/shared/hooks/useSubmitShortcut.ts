import { useEffect, useEffectEvent } from 'react';

/**
 * Ctrl + Entrée (⌘ + Entrée on a Mac) anywhere on the page: submits the form of the screen.
 * `enabled` false (a modal dialog is open over the form): the shortcut does nothing.
 */
export function useSubmitShortcut(onSubmit: () => void, enabled = true): void {
  const submit = useEffectEvent(onSubmit);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
      event.preventDefault();
      submit();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
