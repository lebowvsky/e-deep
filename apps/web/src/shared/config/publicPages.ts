/** The legal pages linked from the footer of the public pages (placeholders until written). */
export const LEGAL_PAGES = [
  { path: '/legal', title: 'Mentions légales' },
  { path: '/privacy', title: 'Confidentialité' },
  { path: '/terms', title: 'Conditions d’utilisation' },
  { path: '/contact', title: 'Contact' },
] as const;

/**
 * Who to ask while the beta has no support channel nor e-mail (D39): forgotten password, contact.
 */
export const BETA_CONTACT_MESSAGE = 'Contacte la personne qui t’a invité à la bêta.';
