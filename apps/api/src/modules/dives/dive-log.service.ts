import type { DiveBuddyRef, DiveDetail, DiveLogResponse, DiveWriteResponse } from '@e-deep/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { queryRows } from '../../common/database/query-rows';
import {
  groupDiveTeams,
  toDiveDetail,
  toDiveDetailBuddies,
  toDiveSummary,
  type DiveDetailRow,
  type DiveDetailTeamRow,
  type DiveObservationRow,
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
           e.creator_id, e.site_id, e.started_at, e.utc_offset_minutes, e.entry_type, e.dive_center,
           p.max_depth_m, p.duration_min, p.water_temperature_c, p.visibility_m, p.gas_mix,
           p.has_decompression, p.stops_ok, p.notes
      FROM dive_participations p
      JOIN dive_events e ON e.id = p.dive_event_id
     WHERE p.diver_id = $1 AND p.deleted_at IS NULL AND e.deleted_at IS NULL
  )`;

/**
 * The site is joined through the event's composite FK (owner = the event's creator), without a
 * `deleted_at` filter: a site used by a live event cannot be tombstoned, a live dive restores its
 * site (D-12 b), and a merge moves the events to its target (D-29), so the name follows a merge
 * without anything to do here. The dashboard joins sites on `s.owner_id = $1` (the diver) instead: same result
 * in the MVP, where the creator is the only participant, but they diverge with shared dives (D-08).
 */
const SITE_JOIN = 'JOIN dive_sites s ON s.owner_id = n.creator_id AND s.id = n.site_id';

const SUMMARY_COLUMNS = `
  n.id, n.participation_id, n.number, n.started_at, n.utc_offset_minutes,
  n.max_depth_m, n.duration_min, n.water_temperature_c, n.gas_mix, n.notes,
  n.entry_type, n.dive_center,
  s.id AS site_id, s.name AS site_name, s.locality AS site_locality, s.region AS site_region`;

/**
 * The detail joins the event and the participation again (by primary key) for the columns the list
 * does not need, so `NUMBERED_LIVE_DIVES`, shared with the list, keeps its weight (D-25). `l` is the
 * diver's level snapshot (D-09).
 */
const DETAIL_JOINS = `
  JOIN dive_events de ON de.id = n.id
  JOIN dive_participations dp ON dp.id = n.participation_id
  JOIN certification_levels l ON l.id = dp.certification_level_id`;

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS},
  n.visibility_m, n.has_decompression, n.stops_ok,
  s.latitude AS site_latitude, s.longitude AS site_longitude, s.area AS site_area,
  l.agency AS level_agency, l.code AS level_code, l.label AS level_label,
  de.time_of_day, de.weather, de.air_temperature_c, de.sea_state, de.current_strength,
  dp.surface_water_temperature_c, dp.safety_stop_duration_min, dp.safety_stop_depth_m,
  dp.is_repetitive, dp.o2_percent, dp.tank_volume_l, dp.tank_material, dp.start_pressure_bar,
  dp.end_pressure_bar, dp.suit_type, dp.suit_thickness_mm, dp.weight_kg,
  dp.created_at, GREATEST(de.updated_at, dp.updated_at) AS updated_at`;

/** Same body for every "not a live dive of yours" case (absent, deleted, another diver's). */
export function diveNotFound(): NotFoundException {
  return new NotFoundException('Dive not found');
}

interface DiveNumberRow {
  id: string;
  number: number;
  updated_at: Date;
}

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
   * A live dive of the diver, by event id, with every field of the event, the participation and
   * the site, the level of each buddy and the observations (three queries, one snapshot).
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
           ${DETAIL_JOINS}
          WHERE n.id = $2`,
        [diverId, eventId],
      );
      if (row === undefined) {
        throw diveNotFound();
      }
      const team = await queryRows<DiveDetailTeamRow>(
        manager,
        `SELECT db.participation_id, b.id, b.first_name, b.last_name,
                l.agency AS level_agency, l.code AS level_code, l.label AS level_label
           FROM dive_buddies db
           JOIN buddies b ON b.owner_id = db.owner_id AND b.id = db.buddy_id
           LEFT JOIN certification_levels l ON l.id = b.certification_level_id
          WHERE db.owner_id = $1 AND db.participation_id = $2 AND b.deleted_at IS NULL
          ORDER BY b.id`,
        [diverId, row.participation_id],
      );
      // The participation was checked as the diver's by the first query.
      const observations = await queryRows<DiveObservationRow>(
        manager,
        `SELECT position, label, count
           FROM dive_observations
          WHERE participation_id = $1
          ORDER BY position`,
        [row.participation_id],
      );
      return toDiveDetail(row, toDiveDetailBuddies(team), observations);
    });
  }

  /**
   * Number (D26) and latest change of a live dive of the diver, as answered to a write. Same
   * numbering and `updatedAt` as the detail. Read within the writing transaction: once committed,
   * a concurrent deletion could turn a successful write into a 404.
   *
   * @throws {NotFoundException} when the dive is not a live dive of the diver.
   */
  async numberOfIn(
    manager: EntityManager,
    diverId: string,
    eventId: string,
  ): Promise<DiveWriteResponse> {
    const [row] = await queryRows<DiveNumberRow>(
      manager,
      `WITH ${NUMBERED_LIVE_DIVES}
       SELECT n.id, n.number, GREATEST(de.updated_at, dp.updated_at) AS updated_at
         FROM numbered n
         JOIN dive_events de ON de.id = n.id
         JOIN dive_participations dp ON dp.id = n.participation_id
        WHERE n.id = $2`,
      [diverId, eventId],
    );
    if (row === undefined) {
      throw diveNotFound();
    }
    return { id: row.id, number: row.number, updatedAt: row.updated_at.toISOString() };
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
