import { cx } from '@/shared/lib/classNames';
import { selfFirst, type DiveMember } from '@/shared/model/dive';
import { Avatar } from '@/shared/ui/Avatar';
import styles from './Palanquee.module.scss';

export interface PalanqueeProps {
  team: readonly DiveMember[];
  /** Avatars shown at most, the « +N » bubble included: 5 desktop, 4 mobile. */
  max: number;
  /** xs 26 (table) · xxs 24 (mobile card) */
  size: 'xs' | 'xxs';
  className?: string | undefined;
}

const fullName = (member: DiveMember) =>
  `${member.firstName} ${member.lastName}${member.isSelf ? ' (toi)' : ''}`;

/**
 * The whole dive team, the user first (neutral avatar). Beyond `max` avatars the last ones are
 * summed up as « +N »; hover or focus lists every name.
 */
export function Palanquee({ team, max, size, className }: PalanqueeProps) {
  const members = selfFirst(team);
  const shown = members.length > max ? members.slice(0, max - 1) : members;
  const rest = members.length - shown.length;
  const names = members.map(fullName).join(', ');

  return (
    <span className={cx(styles.team, styles[size], className)} tabIndex={0}>
      <span className={styles.srOnly}>
        Palanquée de {members.length} : {names}
      </span>
      <span className={styles.avatars} aria-hidden="true">
        {shown.map((member) => (
          <Avatar
            key={member.id}
            initials={member.initials}
            color={member.color}
            tone={member.isSelf ? 'neutral' : 'color'}
            size={size}
            className={styles.avatar}
          />
        ))}
        {rest > 0 && <span className={styles.rest}>+{rest}</span>}
      </span>
      {/* Visual tooltip; readers get the same list from the hidden text above. */}
      <span className={styles.tooltip} aria-hidden="true">
        {names}
      </span>
    </span>
  );
}
