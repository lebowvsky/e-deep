/** The user asked for reduced motion: no smooth scroll, no camera flight. */
export const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scrolls `element` to the middle of the screen — clear of sticky bars — then focuses it. The
 * scroll is smooth unless the user asked for reduced motion.
 */
export function scrollToAndFocus(element: HTMLElement) {
  element.scrollIntoView({
    block: 'center',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
  element.focus({ preventScroll: true });
}
