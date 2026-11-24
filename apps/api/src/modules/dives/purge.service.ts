import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { purgeHorizonStart } from '../../common/sync/sync-rules';
import { SYNC_SETTINGS, type SyncSettings } from '../../common/sync/sync-settings';
import { AuthEvent } from '../auth/auth-event.entity';
import { Session } from '../auth/session.entity';
import { SESSION_LIFETIMES } from '../auth/session-lifetimes';
import { Buddy } from '../buddies/buddy.entity';
import { DiveSite } from '../dive-sites/dive-site.entity';
import { DiveEvent } from './dive-event.entity';
import { DiveParticipation } from './dive-participation.entity';

export interface PurgeReport {
  readonly participations: number;
  readonly events: number;
  readonly buddies: number;
  readonly sites: number;
  /** Sessions past their absolute expiry or their idle window. */
  readonly sessions: number;
  readonly authEvents: number;
}

/** Retention of the security trail (D40, CNIL: 6 months to a year). */
export const AUTH_EVENT_RETENTION_DAYS = 180;

const MS_PER_DAY = 86_400_000;

/**
 * Physical deletion of the tombstones older than the purge horizon (D-12 c), across all divers,
 * then of the expired sessions and of the auth events older than 180 days (D40). Expired sessions
 * are already refused on read: their purge only frees space.
 * No scheduler yet: to be called by a job. The order guarantees it never hits a `RESTRICT`:
 * children first, and a parent still referenced by a child (even a tombstoned one) is kept.
 * `certification_levels` is never purged.
 */
@Injectable()
export class PurgeService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(SYNC_SETTINGS) private readonly settings: SyncSettings,
  ) {}

  purge(now: Date = new Date()): Promise<PurgeReport> {
    const cutoff = purgeHorizonStart(now, this.settings.purgeHorizonDays);

    return this.dataSource.transaction(async (manager) => {
      const deleteTombstones = async (
        target: typeof DiveParticipation | typeof DiveEvent | typeof Buddy | typeof DiveSite,
        keepCondition?: string,
      ): Promise<number> => {
        const query = manager
          .createQueryBuilder()
          .delete()
          .from(target)
          .where('deleted_at < :cutoff', { cutoff });
        if (keepCondition !== undefined) {
          query.andWhere(keepCondition);
        }
        return (await query.execute()).affected ?? 0;
      };

      // 1. Participations (their dive team lines and observations cascade).
      const participations = await deleteTombstones(DiveParticipation);
      // 2. Events without any remaining participation.
      const events = await deleteTombstones(
        DiveEvent,
        'NOT EXISTS (SELECT 1 FROM dive_participations p WHERE p.dive_event_id = dive_events.id)',
      );
      // 3. Buddies (their dive team lines were already removed when tombstoned).
      const buddies = await deleteTombstones(Buddy);
      // 4. Sites without any event, tombstoned ones included (FK RESTRICT), and not the target of
      //    a merged site that stays (D-30). A merged site and its target are deleted by the same
      //    statement, which the `NO ACTION` FK accepts (checked at the end of the statement).
      const sites = await deleteTombstones(
        DiveSite,
        `NOT EXISTS (SELECT 1 FROM dive_events e
                      WHERE e.creator_id = dive_sites.owner_id AND e.site_id = dive_sites.id)
         AND NOT EXISTS (
           SELECT 1 FROM dive_sites merged
            WHERE merged.owner_id = dive_sites.owner_id AND merged.merged_into_id = dive_sites.id
              AND NOT (merged.deleted_at < :cutoff AND NOT EXISTS (
                SELECT 1 FROM dive_events me
                 WHERE me.creator_id = merged.owner_id AND me.site_id = merged.id)))`,
      );
      // 5. Sessions: absolute expiry passed, or idle for longer than their audience allows.
      const sessions =
        (
          await manager
            .createQueryBuilder()
            .delete()
            .from(Session)
            .where('expires_at <= :now', { now })
            .orWhere("audience = 'web' AND last_seen_at <= :webIdleSince", {
              webIdleSince: new Date(now.getTime() - SESSION_LIFETIMES.web.idleMs),
            })
            .orWhere("audience = 'admin' AND last_seen_at <= :adminIdleSince", {
              adminIdleSince: new Date(now.getTime() - SESSION_LIFETIMES.admin.idleMs),
            })
            .execute()
        ).affected ?? 0;
      // 6. Security trail past its retention.
      const authEvents =
        (
          await manager
            .createQueryBuilder()
            .delete()
            .from(AuthEvent)
            .where('occurred_at < :since', {
              since: new Date(now.getTime() - AUTH_EVENT_RETENTION_DAYS * MS_PER_DAY),
            })
            .execute()
        ).affected ?? 0;
      return { participations, events, buddies, sites, sessions, authEvents };
    });
  }
}
