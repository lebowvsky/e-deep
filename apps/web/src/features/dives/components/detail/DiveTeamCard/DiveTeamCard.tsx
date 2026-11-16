import { selfFirst, type DiveMember } from '@/shared/model/dive';
import { Avatar } from '@/shared/ui/Avatar';
import { sharedDivesLabel, teamSizeLabel } from '../../../lib/labels';
import { DetailSection } from '../DetailSection';
import styles from './DiveTeamCard.module.scss';

export interface DiveTeamCardProps {
  team: readonly DiveMember[];
  /** Dives shared with each buddy; `null` while the log is unknown. */
  sharedDives: ReadonlyMap<string, number> | null;
  className?: string | undefined;
}

/** « Palanquée »: every member, the user first (neutral avatar, « · toi »). */
export function DiveTeamCard({ team, sharedDives, className }: DiveTeamCardProps) {
  const members = selfFirst(team);
  return (
    <DetailSection
      title={`Palanquée · ${teamSizeLabel(members.length)}`}
      icon="users"
      className={className}
    >
      <ul className={styles.members}>
        {members.map((member) => {
          const shared = member.isSelf ? undefined : sharedDives?.get(member.id);
          return (
            <li key={member.id} className={styles.member}>
              <Avatar
                initials={member.initials}
                color={member.color}
                tone={member.isSelf ? 'neutral' : 'color'}
                size="md"
              />
              <span className={styles.identity}>
                <span className={styles.name}>
                  {member.firstName} {member.lastName}
                  {member.isSelf && <span className={styles.self}> · toi</span>}
                </span>
                {shared !== undefined && (
                  <span className={styles.shared}>{sharedDivesLabel(shared)}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </DetailSection>
  );
}
