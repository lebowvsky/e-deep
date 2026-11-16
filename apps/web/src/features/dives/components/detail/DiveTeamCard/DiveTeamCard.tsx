import { formatDiverLevel } from '@/shared/lib/format';
import { selfFirst } from '@/shared/model/dive';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { sharedDivesLabel, teamSizeLabel } from '../../../lib/labels';
import type { DiveDetailMember } from '../../../types';
import { DetailSection } from '../DetailSection';
import styles from './DiveTeamCard.module.scss';

export interface DiveTeamCardProps {
  team: readonly DiveDetailMember[];
  /** Dives shared with each buddy; `null` while the log is unknown. */
  sharedDives: ReadonlyMap<string, number> | null;
  className?: string | undefined;
}

/**
 * « Palanquée » (dive-detail.jsx · PalanqueeCard): every member, the user first (neutral avatar,
 * « · toi »), each with a level tag on the right. Under the name: the user's level at the time of
 * the dive, or the dives shared with a buddy.
 */
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
          const { level } = member;
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
                {member.isSelf && level !== null && (
                  <span className={styles.detail}>
                    {formatDiverLevel(level.code, level.agency)}
                  </span>
                )}
                {shared !== undefined && (
                  <span className={styles.detail}>{sharedDivesLabel(shared)}</span>
                )}
              </span>
              {level !== null && (
                <Badge className={styles.level}>
                  <span className={styles.srOnly}>Niveau </span>
                  {level.code}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </DetailSection>
  );
}
