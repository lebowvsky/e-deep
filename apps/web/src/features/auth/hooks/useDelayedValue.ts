import { useEffect, useState } from 'react';

/**
 * `value`, once it has stopped changing for `delayMs`: what a polite live region reads, so that a
 * screen reader is not interrupted at every keystroke (accueil.md · password criteria).
 */
export function useDelayedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
