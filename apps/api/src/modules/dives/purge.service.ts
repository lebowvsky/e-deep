import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { purgeHorizonStart } from '../../common/sync/sync-rules';
import { SYNC_SETTINGS, type SyncSettings } from '../../common/sync/sync-settings';
import { Buddy } from '../buddies/buddy.entity';
import { DiveSite } from '../dive-sites/dive-site.entity';
import { DiveEvent } from './dive-event.entity';
import { DiveParticipation } from './dive-participation.entity';

export interface PurgeReport {
  readonly participations: number;
  readonly events: number;
  readonly buddies: number;
  readonly sites: number;
}

/**
 * Physical deletion of the tombstones older than the purge horizon (D-12 c), across all divers.
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

      // 1. Participations (their dive team lines cascade).
      const participations = await deleteTombstones(DiveParticipation);
      // 2. Events without any remaining participation.
      const events = await deleteTombstones(
        DiveEvent,
        'NOT EXISTS (SELECT 1 FROM dive_participations p WHERE p.dive_event_id = dive_events.id)',
      );
      // 3. Buddies (their dive team lines were already removed when tombstoned).
      const buddies = await deleteTombstones(Buddy);
      // 4. Sites without any event, tombstoned ones included (FK RESTRICT).
      const sites = await deleteTombstones(
        DiveSite,
        `NOT EXISTS (SELECT 1 FROM dive_events e
                      WHERE e.creator_id = dive_sites.owner_id AND e.site_id = dive_sites.id)`,
      );
      return { participations, events, buddies, sites };
    });
  }
}
