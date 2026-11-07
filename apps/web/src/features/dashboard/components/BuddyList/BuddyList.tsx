import { useId } from 'react';
import { formatDiveCount, formatInitials, formatShortName } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Overline } from '@/shared/ui/Overline';
import { TextLink } from '@/shared/ui/TextLink';
import type { Buddy } from '../../types';
import { ResponsiveText } from '../ResponsiveText';
import styles from './BuddyList.module.scss';

export interface BuddyListProps {
  buddies: readonly Buddy[];
}

/** Frequent buddies, horizontally scrollable (no visible scrollbar). */
export function BuddyList({ buddies }: BuddyListProps) {
  const titleId = useId();

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Overline>Binômes fréquents</Overline>
          <h2 id={titleId} className={styles.title}>
            {buddies.length} palanquées régulières
          </h2>
        </div>
        <TextLink to="/buddies" aria-label="Voir tous les binômes">
          <ResponsiveText text={{ short: 'Tous', long: 'Voir tous' }} />
        </TextLink>
      </header>
      {/* Focusable so keyboard users can scroll the row. */}
      <ul className={styles.list} tabIndex={0} aria-label="Binômes">
        {buddies.map((buddy) => (
          <li key={buddy.id} className={styles.item}>
            <Avatar
              className={styles.avatar}
              initials={buddy.initials || formatInitials(buddy.firstName, buddy.lastName)}
              color={buddy.accentColor}
              size="lg"
            />
            <div className={styles.identity}>
              <span className={styles.name}>
                <ResponsiveText
                  text={{
                    short: formatShortName(buddy.firstName, buddy.lastName),
                    long: `${buddy.firstName} ${buddy.lastName}`,
                  }}
                />
              </span>
              <span className={styles.count}>
                <span aria-hidden="true">
                  <ResponsiveText
                    text={{
                      short: `${buddy.sharedDives} ×`,
                      long: formatDiveCount(buddy.sharedDives),
                    }}
                  />
                </span>
                <span className={styles.srOnly}>{formatDiveCount(buddy.sharedDives)} ensemble</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
