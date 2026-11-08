import type {
  DashboardBuddy,
  DashboardDive,
  DashboardResponse,
  DashboardSite,
  DashboardStats,
  GasMix,
} from '@e-deep/shared';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { queryRows } from '../../common/database/query-rows';
import { InvalidReferenceError } from '../../common/errors/domain-errors';
import { Diver } from '../divers/diver.entity';
import { toFederation, toUserLevel } from '../divers/diver-contract.mapper';
import { toLocalDateTime } from '../dives/dive-contract.mapper';
import { fillMonthlySeries, lastTwelveMonths, seriesLowerBound } from './monthly-series';

const FREQUENT_BUDDIES = 6;

/** Fixed orderings of `dive()`: never built from input. */
const DIVE_ORDERS = {
  latest: 'l.started_at DESC, l.id DESC',
  deepest: 'l.max_depth_m DESC, l.started_at DESC, l.id DESC',
} as const;

/**
 * Live dives of the diver ($1): participation and event both alive (D-08). Uses the partial index
 * `idx_dive_participations__diver_id_dive_event_id`; the event is joined by primary key.
 */
const LIVE_DIVES = `
  live AS (
    SELECT p.id, p.max_depth_m, p.duration_min, p.water_temperature_c, p.visibility_m, p.gas_mix,
           p.has_decompression, p.stops_ok, p.notes,
           e.started_at, e.utc_offset_minutes, e.site_id
      FROM dive_participations p
      JOIN dive_events e ON e.id = p.dive_event_id
     WHERE p.diver_id = $1 AND p.deleted_at IS NULL AND e.deleted_at IS NULL
  )`;

interface TotalsRow {
  total: number;
  minutes: number;
}

interface MonthRow {
  month: string;
  count: number;
}

interface SiteRow {
  id: string;
  name: string;
  region: string;
  latitude: string;
  longitude: string;
  dive_count: number;
  max_depth_m: string;
}

interface DiveRow {
  id: string;
  max_depth_m: string;
  duration_min: number;
  water_temperature_c: string | null;
  visibility_m: number | null;
  gas_mix: GasMix;
  has_decompression: boolean;
  stops_ok: boolean;
  notes: string | null;
  started_at: Date;
  utc_offset_minutes: number;
  site_id: string;
  site_name: string;
  site_region: string;
}

interface BuddyRow {
  id: string;
  first_name: string;
  last_name: string;
  shared_dives: number;
}

/**
 * Dashboard of a diver, computed on the fly (H-14: a few thousand dives at most). Health data: the
 * response is only ever served to the diver themselves, and nothing here is logged.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  /** @throws {InvalidReferenceError} when the diver does not exist. */
  getDashboard(diverId: string, now: Date = new Date()): Promise<DashboardResponse> {
    // One snapshot for every query, so the figures are consistent with each other.
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const diver = await manager.findOne(Diver, {
        where: { id: diverId },
        relations: { certificationLevel: true },
      });
      if (diver?.certificationLevel === undefined) {
        throw new InvalidReferenceError();
      }

      // Sequential: the queries share the transaction's single connection.
      const totals = await this.totals(manager, diverId);
      const sites = await this.sites(manager, diverId);
      const buddies = await this.buddies(manager, diverId);
      const lastDive = await this.dive(manager, diverId, 'latest');
      const deepest = await this.dive(manager, diverId, 'deepest');
      const months = await this.monthlyCounts(manager, diverId, now);

      const divesPerMonth = fillMonthlySeries(lastTwelveMonths(now), months);
      const stats: DashboardStats = {
        totalDives: totals.total,
        totalUnderwaterMinutes: totals.minutes,
        maxDepthEver:
          deepest === null
            ? null
            : {
                depthM: Number(deepest.max_depth_m),
                siteName: deepest.site_name,
                date: toLocalDateTime(deepest.started_at, deepest.utc_offset_minutes),
              },
        sitesVisited: sites.length,
        divesPerMonth,
        divesThisMonth: divesPerMonth.at(-1)?.count ?? 0,
        mainRegion: mainRegion(sites),
      };

      return {
        user: {
          id: diver.id,
          firstName: diver.firstName,
          lastName: diver.lastName,
          level: toUserLevel(diver.certificationLevel),
          federation: toFederation(diver.certificationLevel),
          avatarUrl: diver.avatarUrl,
        },
        stats,
        lastDive:
          lastDive === null
            ? null
            : toDashboardDive(lastDive, await this.diveTeam(manager, lastDive.id, buddies)),
        sites,
        frequentBuddies: buddies
          .filter((buddy) => buddy.sharedDives > 0)
          .slice(0, FREQUENT_BUDDIES),
      };
    });
  }

  private async totals(manager: EntityManager, diverId: string): Promise<TotalsRow> {
    const [row] = await queryRows<TotalsRow>(
      manager,
      `WITH ${LIVE_DIVES}
       SELECT count(*)::int AS total, coalesce(sum(duration_min), 0)::int AS minutes FROM live`,
      [diverId],
    );
    return row ?? { total: 0, minutes: 0 };
  }

  /** Sites with at least one live dive, most dived first. */
  private async sites(manager: EntityManager, diverId: string): Promise<DashboardSite[]> {
    const rows = await queryRows<SiteRow>(
      manager,
      `WITH ${LIVE_DIVES}
       SELECT s.id, s.name, s.region, s.latitude, s.longitude,
              count(*)::int AS dive_count, max(l.max_depth_m) AS max_depth_m
         FROM live l
         JOIN dive_sites s ON s.owner_id = $1 AND s.id = l.site_id
        GROUP BY s.id
        ORDER BY dive_count DESC, s.name, s.id`,
      [diverId],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      region: row.region,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      diveCount: row.dive_count,
      maxDepthM: Number(row.max_depth_m),
    }));
  }

  /** Live buddies of the diver with their number of shared live dives, most frequent first. */
  private async buddies(manager: EntityManager, diverId: string): Promise<DashboardBuddy[]> {
    const rows = await queryRows<BuddyRow>(
      manager,
      `WITH ${LIVE_DIVES}
       SELECT b.id, b.first_name, b.last_name, count(l.id)::int AS shared_dives
         FROM buddies b
         JOIN dive_buddies db ON db.owner_id = b.owner_id AND db.buddy_id = b.id
         JOIN live l ON l.id = db.participation_id
        WHERE b.owner_id = $1 AND b.deleted_at IS NULL
        GROUP BY b.id
        ORDER BY shared_dives DESC, b.last_name, b.first_name, b.id`,
      [diverId],
    );
    return rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      sharedDives: row.shared_dives,
    }));
  }

  /** The latest or the deepest live dive. */
  private async dive(
    manager: EntityManager,
    diverId: string,
    order: keyof typeof DIVE_ORDERS,
  ): Promise<DiveRow | null> {
    const [row] = await queryRows<DiveRow>(
      manager,
      `WITH ${LIVE_DIVES}
       SELECT l.*, s.name AS site_name, s.region AS site_region
         FROM live l
         JOIN dive_sites s ON s.owner_id = $1 AND s.id = l.site_id
        ORDER BY ${DIVE_ORDERS[order]}
        LIMIT 1`,
      [diverId],
    );
    return row ?? null;
  }

  /** Live dives per *local* month (`started_at` shifted by its offset), from the series start. */
  private async monthlyCounts(
    manager: EntityManager,
    diverId: string,
    now: Date,
  ): Promise<Map<string, number>> {
    const rows = await queryRows<MonthRow>(
      manager,
      `WITH ${LIVE_DIVES}
       SELECT to_char((started_at AT TIME ZONE 'UTC') + make_interval(mins => utc_offset_minutes), 'YYYY-MM') AS month,
              count(*)::int AS count
         FROM live
        WHERE started_at >= $2
        GROUP BY 1`,
      [diverId, seriesLowerBound(now)],
    );
    return new Map(rows.map((row) => [row.month, row.count]));
  }

  /** Dive team of a participation, with the shared dive counts already computed. */
  private async diveTeam(
    manager: EntityManager,
    participationId: string,
    buddies: readonly DashboardBuddy[],
  ): Promise<DashboardBuddy[]> {
    const rows = await queryRows<{ buddy_id: string }>(
      manager,
      'SELECT buddy_id FROM dive_buddies WHERE participation_id = $1',
      [participationId],
    );
    const team = new Set(rows.map((row) => row.buddy_id));
    return buddies.filter((buddy) => team.has(buddy.id));
  }
}

function toDashboardDive(row: DiveRow, buddies: DashboardBuddy[]): DashboardDive {
  return {
    id: row.id,
    date: toLocalDateTime(row.started_at, row.utc_offset_minutes),
    utcOffsetMinutes: row.utc_offset_minutes,
    site: { id: row.site_id, name: row.site_name, region: row.site_region },
    depthMaxM: Number(row.max_depth_m),
    durationMin: row.duration_min,
    temperatureC: row.water_temperature_c === null ? null : Number(row.water_temperature_c),
    visibilityM: row.visibility_m,
    gasMix: row.gas_mix,
    hadDecompression: row.has_decompression,
    stopsOk: row.stops_ok,
    notes: row.notes,
    buddies,
  };
}

/** Region with the most live dives (ties: alphabetical). */
function mainRegion(sites: readonly DashboardSite[]): string | null {
  const counts = new Map<string, number>();
  for (const site of sites) {
    counts.set(site.region, (counts.get(site.region) ?? 0) + site.diveCount);
  }
  let best: { region: string; count: number } | null = null;
  for (const [region, count] of counts) {
    if (best === null || count > best.count || (count === best.count && region < best.region)) {
      best = { region, count };
    }
  }
  return best?.region ?? null;
}
