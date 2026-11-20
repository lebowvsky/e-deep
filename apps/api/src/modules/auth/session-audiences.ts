/**
 * Audience of a session (D34, D37): the web front (divers) or the admin back office (staff), each
 * with its own cookie. Stored as `text` + `CHECK` (`ck_sessions__audience`), same values.
 */
export const SESSION_AUDIENCES = ['web', 'admin'] as const;
export type SessionAudience = (typeof SESSION_AUDIENCES)[number];
