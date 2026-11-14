import type { DiveBuddyRef, DiveDetail, DiveLogResponse } from '@e-deep/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { queryRows } from '../../common/database/query-rows';
import {
  groupDiveTeams,
  toDiveDetail,
  toDiveSummary,
  type DiveDetailRow,
  type DiveSummaryRow,
  type DiveTeamRow,
} from './dive-contract.mapper';

/**
 * Server cap of `GET /api/dives`: the whole log is returned (the selection is done by the front),
 * and H-14 expects a few thousand dives at most. Beyond it, only the latest dives are served; their
 * numbers stay those of the whole log.
 */
export const DIVE_LOG_MAX = 5000;

/**
 * Live dives of the diver ($1), numbered chronologically over the whole live log (oldest = 1), so
 * a dive keeps the same number in the list and in its detail. Participation and event both alive
 * (D-08), as in the dashboard. The participations are read through the partial index
 * `idx_dive_participations__diver_id_dive_event_id`; with the default cost settings the planner
 * joins the events by Seq Scan + Hash Join (observed on 204k events), not by primary key, which it
 * only picks with a low `random_page_cost` (~1.1, SSD).
 */
const NUMBERED_LIVE_DIVES = `
  numbered AS (
    SELECT e.id, p.id AS participation_id,
           (row_number() OVER (ORDER BY e.started_at, e.id))::int AS number,
           e.creator_id, e.site_id, e.started_at, e.utc_offset_minutes,
           p.max_depth_m, p.duration_min, p.water_temperature_c, p.visibility_m, p.gas_mix,
           p.has_decompression, p.stops_ok, p.notes
      FROM dive_participations p
      JOIN dive_events e ON e.id = p.dive_event_id
     WHERE p.diver_id = $1 AND p.deleted_at IS NULL AND e.deleted_at IS NULL
  )`;

/**
 * The site is joined through the event's composite FK (owner = the event's creator), without a
 * `deleted_at` filter: a site used by a live event cannot be tombstoned, and a live dive restores
 * its site (D-12 b). The dashboard joins sites on `s.owner_id = $1` (the diver) instead: same result
 * in the MVP, where the creator is the only participant, but they diverge with shared dives (D-08).
 */
const SITE_JOIN = 'JOIN dive_sites s ON s.owner_id = n.creator_id AND s.id = n.site_id';

const SUMMARY_COLUMNS = `
  n.id, n.participation_id, n.number, n.started_at, n.utc_offset_minutes,
  n.max_depth_m, n.duration_min, n.water_temperature_c, n.gas_mix, n.notes,
  s.id AS site_id, s.name AS site_name, s.locality AS site_locality, s.region AS site_region`;

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS},
  n.visibility_m, n.has_decompression, n.stops_ok,
  s.latitude AS site_latitude, s.longitude AS site_longitude`;

/**
 * Read model of the diver's dive log, separate from the synchronisation (`DivesService`). Every
 * query is filtered by the owner (`diver_id`). Health data: nothing here is logged.
 */
@Injectable()
export class DiveLogService {
  constructor(private readonly dataSource: DataSource) {}

  /** Every live dive of the diver (up to `DIVE_LOG_MAX`), latest first. */
  findAll(diverId: string): Promise<DiveLogResponse> {
    // One snapshot for both queries, so the teams match the dives.
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const rows = await queryRows<DiveSummaryRow>(
        manager,
        `WITH ${NUMBERED_LIVE_DIVES}
         SELECT ${SUMMARY_COLUMNS}
           FROM numbered n
           ${SITE_JOIN}
          ORDER BY n.started_at DESC, n.id DESC
          LIMIT $2`,
        [diverId, DIVE_LOG_MAX],
      );
      const teams = await loadDiveTeams(
        manager,
        diverId,
        rows.map((row) => row.participation_id),
      );
      return {
        dives: rows.map((row) => toDiveSummary(row, teams.get(row.participation_id) ?? [])),
      };
    });
  }

  /**
   * A live dive of the diver, by event id.
   *
   * @throws {NotFoundException} when the dive does not exist, is deleted or belongs to another
   *   diver: the three cases are indistinguishable on purpose.
   */
  findOne(diverId: string, eventId: string): Promise<DiveDetail> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const [row] = await queryRows<DiveDetailRow>(
        manager,
        `WITH ${NUMBERED_LIVE_DIVES}
         SELECT ${DETAIL_COLUMNS}
           FROM numbered n
           ${SITE_JOIN}
          WHERE n.id = $2`,
        [diverId, eventId],
      );
      if (row === undefined) {
        throw new NotFoundException('Dive not found');
      }
      const teams = await loadDiveTeams(manager, diverId, [row.participation_id]);
      return toDiveDetail(row, teams.get(row.participation_id) ?? []);
    });
  }
}

/**
 * Dive teams of the participations, in one query. Live buddies only, as in the dashboard (a
 * tombstoned buddy is already removed from every team). Ordered by buddy id, like the sync
 * `loadDiveTeams` of `DivesService`.
 */
async function loadDiveTeams(
  manager: EntityManager,
  diverId: string,
  participationIds: readonly string[],
): Promise<Map<string, DiveBuddyRef[]>> {
  if (participationIds.length === 0) {
    return new Map();
  }
  const rows = await queryRows<DiveTeamRow>(
    manager,
    `SELECT db.participation_id, b.id, b.first_name, b.last_name
       FROM dive_buddies db
       JOIN buddies b ON b.owner_id = db.owner_id AND b.id = db.buddy_id
      WHERE db.owner_id = $1 AND db.participation_id = ANY($2::uuid[]) AND b.deleted_at IS NULL
      ORDER BY db.participation_id, b.id`,
    [diverId, participationIds],
  );
  return groupDiveTeams(rows);
}
