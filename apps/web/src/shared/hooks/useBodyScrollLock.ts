import { useEffect } from 'react';

/** Prevents the page behind a modal surface from scrolling while `active`. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [active]);
}
