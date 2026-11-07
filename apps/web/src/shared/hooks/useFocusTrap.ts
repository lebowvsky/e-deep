import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keeps keyboard focus inside `containerRef` while `active`: focuses the first focusable element
 * on activation, cycles Tab / Shift+Tab, and gives focus back to the previously focused element
 * on deactivation.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [containerRef, active]);
}
