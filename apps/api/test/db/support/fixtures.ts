import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { SyncSettings } from '../../../src/common/sync/sync-settings';
import { Buddy } from '../../../src/modules/buddies/buddy.entity';
import type { BuddyWrite } from '../../../src/modules/buddies/buddies.service';
import { CertificationLevel } from '../../../src/modules/certification-levels/certification-level.entity';
import { DiveSite } from '../../../src/modules/dive-sites/dive-site.entity';
import type { DiveSiteWrite } from '../../../src/modules/dive-sites/dive-sites.service';
import { Diver } from '../../../src/modules/divers/diver.entity';
import { DiveBuddy } from '../../../src/modules/dives/dive-buddy.entity';
import { DiveEvent } from '../../../src/modules/dives/dive-event.entity';
import { DiveParticipation } from '../../../src/modules/dives/dive-participation.entity';
import type { DiveWrite } from '../../../src/modules/dives/dive.types';

export const SYNC_SETTINGS_90_DAYS: SyncSettings = { purgeHorizonDays: 90 };

/** A last pull that is always within the purge horizon. */
export const recentPull = (): Date => new Date();

/** Rows inserted directly (bypassing the services) to test the schema itself. */
export class Fixtures {
  constructor(private readonly dataSource: DataSource) {}

  private get manager() {
    return this.dataSource.manager;
  }

  async levelId(code = 'N1', agency = 'FFESSM'): Promise<string> {
    return (await this.manager.findOneByOrFail(CertificationLevel, { agency, code })).id;
  }

  async addLevel(values: Partial<CertificationLevel> = {}): Promise<CertificationLevel> {
    const id = randomUUID();
    await this.manager.insert(CertificationLevel, {
      id,
      agency: 'CMAS',
      code: `L${id.slice(0, 8)}`,
      label: 'Test level',
      rank: 50,
      ...values,
    });
    return this.manager.findOneByOrFail(CertificationLevel, { id });
  }

  async diver(values: Partial<Diver> = {}): Promise<Diver> {
    const id = randomUUID();
    await this.manager.insert(Diver, {
      id,
      firstName: 'Alex',
      lastName: 'Martin',
      certificationLevelId: values.certificationLevelId ?? (await this.levelId()),
      avatarUrl: null,
      ...values,
    });
    return this.manager.findOneByOrFail(Diver, { id });
  }

  async site(ownerId: string, values: Partial<DiveSite> = {}): Promise<DiveSite> {
    const id = values.id ?? randomUUID();
    await this.manager.insert(DiveSite, {
      ownerId,
      name: 'La Vesse',
      region: 'Côte Bleue',
      latitude: 43.33,
      longitude: 5.25,
      ...values,
      id,
    });
    return this.manager.findOneByOrFail(DiveSite, { id });
  }

  async buddy(ownerId: string, values: Partial<Buddy> = {}): Promise<Buddy> {
    const id = values.id ?? randomUUID();
    await this.manager.insert(Buddy, {
      ownerId,
      firstName: 'Sam',
      lastName: 'Durand',
      linkedDiverId: null,
      ...values,
      id,
    });
    return this.manager.findOneByOrFail(Buddy, { id });
  }

  async event(
    creatorId: string,
    siteId: string,
    values: Partial<DiveEvent> = {},
  ): Promise<DiveEvent> {
    const id = values.id ?? randomUUID();
    await this.manager.insert(DiveEvent, {
      creatorId,
      siteId,
      startedAt: new Date('2026-07-14T08:00:00.000Z'),
      utcOffsetMinutes: 120,
      ...values,
      id,
    });
    return this.manager.findOneByOrFail(DiveEvent, { id });
  }

  async participation(
    diveEventId: string,
    diverId: string,
    values: Partial<DiveParticipation> = {},
  ): Promise<DiveParticipation> {
    const id = values.id ?? randomUUID();
    await this.manager.insert(DiveParticipation, {
      diveEventId,
      diverId,
      certificationLevelId: values.certificationLevelId ?? (await this.levelId()),
      maxDepthM: 20,
      durationMin: 45,
      waterTemperatureC: 18.5,
      visibilityM: 15,
      gasMix: 'AIR',
      hasDecompression: false,
      stopsOk: true,
      notes: null,
      ...values,
      id,
    });
    return this.manager.findOneByOrFail(DiveParticipation, { id });
  }

  async diveBuddy(ownerId: string, participationId: string, buddyId: string): Promise<void> {
    await this.manager.insert(DiveBuddy, { ownerId, participationId, buddyId });
  }

  /** Site + event + participation (+ dive team) of one diver, as the MVP writes them. */
  async dive(diverId: string, buddyIds: readonly string[] = []) {
    const site = await this.site(diverId);
    const event = await this.event(diverId, site.id);
    const participation = await this.participation(event.id, diverId);
    for (const buddyId of buddyIds) {
      await this.diveBuddy(diverId, participation.id, buddyId);
    }
    return { site, event, participation };
  }

  /** Moves a tombstone back in time, beyond the purge horizon. */
  async ageTombstone(table: string, id: string, days: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${table}" SET deleted_at = now() - make_interval(days => $2) WHERE id = $1`,
      [id, days],
    );
  }
}

export function siteWrite(values: Partial<DiveSiteWrite> = {}): DiveSiteWrite {
  return {
    id: randomUUID(),
    name: 'Les Impériaux',
    region: 'Marseille',
    latitude: 43.2,
    longitude: 5.33,
    baseUpdatedAt: null,
    deletedAt: null,
    ...values,
  };
}

export function buddyWrite(values: Partial<BuddyWrite> = {}): BuddyWrite {
  return {
    id: randomUUID(),
    firstName: 'Camille',
    lastName: 'Bernard',
    linkedDiverId: null,
    baseUpdatedAt: null,
    deletedAt: null,
    ...values,
  };
}

export function diveWrite(
  siteId: string,
  values: {
    event?: Partial<DiveWrite['event']>;
    participation?: Partial<DiveWrite['participation']>;
    buddyIds?: readonly string[];
  } = {},
): DiveWrite {
  return {
    event: {
      id: randomUUID(),
      siteId,
      startedAt: new Date('2026-08-01T07:30:00.000Z'),
      utcOffsetMinutes: 120,
      baseUpdatedAt: null,
      deletedAt: null,
      ...values.event,
    },
    participation: {
      id: randomUUID(),
      maxDepthM: 32.5,
      durationMin: 52,
      waterTemperatureC: 19,
      visibilityM: 20,
      gasMix: 'NITROX32',
      hasDecompression: false,
      stopsOk: true,
      notes: null,
      baseUpdatedAt: null,
      deletedAt: null,
      ...values.participation,
    },
    buddyIds: values.buddyIds ?? [],
  };
}
