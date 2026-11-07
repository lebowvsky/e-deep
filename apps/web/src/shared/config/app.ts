/** Product name shown in the UI. The mockups still say « DiveLog »: always use this constant. */
export const APP_NAME = 'E-Deep';

/** Document title of a page: « Tableau de bord · E-Deep » (WCAG 2.4.2). */
export function pageTitle(title: string): string {
  return `${title} · ${APP_NAME}`;
}
