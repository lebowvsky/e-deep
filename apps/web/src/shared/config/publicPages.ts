/**
 * The legal pages linked from the footer of the public pages (placeholders until written);
 * `shortTitle` on phones (welcome.jsx · mobile footer).
 */
export const LEGAL_PAGES = [
  { path: '/legal', title: 'Mentions légales', shortTitle: 'Mentions légales' },
  { path: '/privacy', title: 'Confidentialité', shortTitle: 'Confidentialité' },
  { path: '/terms', title: 'Conditions d’utilisation', shortTitle: 'Conditions' },
  { path: '/contact', title: 'Contact', shortTitle: 'Contact' },
] as const;

/**
 * Who to ask while the beta has no support channel nor e-mail (D39): forgotten password, contact.
 */
export const BETA_CONTACT_MESSAGE = 'Contacte la personne qui t’a invité à la bêta.';
