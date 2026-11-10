// Dive log mocks — the people of the dive teams (mockups: dives-list.jsx · BUDDY).
// Ids b1–b6 and the user id match the dashboard mocks.
import type { DiveMember } from '@/shared/model/dive';

export const SELF: DiveMember = {
  id: 'u1',
  firstName: 'Marine',
  lastName: 'Rousseau',
  initials: 'MR',
  isSelf: true,
};

const buddy = (
  id: string,
  firstName: string,
  lastName: string,
  initials: string,
  color: string,
): DiveMember => ({ id, firstName, lastName, initials, color, isSelf: false });

/** The 14 divers met, keyed by their initials (as in the mockup). */
export const BUDDIES = {
  LB: buddy('b1', 'Lucas', 'Bernard', 'LB', '#3a5a82'),
  TN: buddy('b2', 'Thao', 'Nguyen', 'TN', '#2a6a6a'),
  EM: buddy('b3', 'Élise', 'Marchand', 'EM', '#5a3a7a'),
  RP: buddy('b4', 'Rémi', 'Pascal', 'RP', '#3a7a5a'),
  SB: buddy('b5', 'Sofia', 'Barros', 'SB', '#7a5a3a'),
  JK: buddy('b6', 'Julien', 'Kervella', 'JK', '#3a4a7a'),
  CL: buddy('b7', 'Camille', 'Leroy', 'CL', '#6a4a3a'),
  MA: buddy('b8', 'Mathieu', 'Aubert', 'MA', '#2f5a6e'),
  HD: buddy('b9', 'Hugo', 'Durand', 'HD', '#4a5a2f'),
  NF: buddy('b10', 'Nina', 'Fabre', 'NF', '#6a3a52'),
  YL: buddy('b11', 'Yann', 'Le Goff', 'YL', '#3a6a7a'),
  GM: buddy('b12', 'Gwenaëlle', 'Morvan', 'GM', '#4a3a6e'),
  PF: buddy('b13', 'Paul', 'Ferrand', 'PF', '#5a6a3a'),
  IC: buddy('b14', 'Inès', 'Caradec', 'IC', '#7a3a4a'),
} as const satisfies Record<string, DiveMember>;

export type BuddyKey = keyof typeof BUDDIES;
