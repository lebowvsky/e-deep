// Domain types shared by several features (dashboard, dive log).
//
// A dive is a shared event (site, date, dive team) with one participation per diver (depth,
// duration, gas…). The dive team (« palanquée ») gathers two divers or more, the user included.

/** One diver of a dive team. The current user is flagged `isSelf`. */
export interface DiveMember {
  id: string;
  firstName: string;
  lastName: string;
  /** « LB » */
  initials: string;
  /** Avatar colour, from the data. Absent for the user (neutral avatar) or when unknown. */
  color?: string;
  isSelf: boolean;
}

/** The user first, then the other members in their recorded order. */
export function selfFirst(team: readonly DiveMember[]): DiveMember[] {
  return [...team.filter((member) => member.isSelf), ...team.filter((member) => !member.isSelf)];
}

/** The members other than the user. */
export function othersInTeam(team: readonly DiveMember[]): DiveMember[] {
  return team.filter((member) => !member.isSelf);
}
