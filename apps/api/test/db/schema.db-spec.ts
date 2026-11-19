import type { DataSource } from 'typeorm';
import { Fixtures } from './support/fixtures';
import { selectRows } from './support/sql';
import { createTestDataSource, resetDatabase } from './support/test-database';

const CONSTRAINTS = [
  'pk_certification_levels',
  'uq_certification_levels__agency_code',
  'ck_certification_levels__agency',
  'ck_certification_levels__code',
  'ck_certification_levels__label',
  'ck_certification_levels__rank',
  'pk_divers',
  'fk_divers__certification_level_id',
  'ck_divers__first_name',
  'ck_divers__last_name',
  'ck_divers__avatar_url',
  'pk_dive_sites',
  'fk_dive_sites__owner_id',
  'uq_dive_sites__owner_id_id',
  'ck_dive_sites__name',
  'ck_dive_sites__locality',
  'ck_dive_sites__region',
  'ck_dive_sites__latitude',
  'ck_dive_sites__longitude',
  'ck_dive_sites__area',
  'ck_dive_sites__position',
  'pk_buddies',
  'fk_buddies__owner_id',
  'fk_buddies__linked_diver_id',
  'uq_buddies__owner_id_id',
  'ck_buddies__first_name',
  'ck_buddies__last_name',
  'ck_buddies__not_self',
  'fk_buddies__certification_level_id',
  'pk_dive_events',
  'fk_dive_events__creator_id',
  'fk_dive_events__creator_id_site_id',
  'ck_dive_events__utc_offset_minutes',
  'ck_dive_events__entry_type',
  'ck_dive_events__time_of_day',
  'ck_dive_events__weather',
  'ck_dive_events__air_temperature_c',
  'ck_dive_events__sea_state',
  'ck_dive_events__current_strength',
  'ck_dive_events__dive_center',
  'pk_dive_participations',
  'fk_dive_participations__dive_event_id',
  'fk_dive_participations__diver_id',
  'fk_dive_participations__certification_level_id',
  'uq_dive_participations__dive_event_id_diver_id',
  'uq_dive_participations__diver_id_id',
  'ck_dive_participations__max_depth_m',
  'ck_dive_participations__duration_min',
  'ck_dive_participations__water_temperature_c',
  'ck_dive_participations__visibility_m',
  'ck_dive_participations__gas_mix',
  'ck_dive_participations__notes',
  'ck_dive_participations__surface_water_temperature_c',
  'ck_dive_participations__safety_stop_duration_min',
  'ck_dive_participations__safety_stop_depth_m',
  'ck_dive_participations__safety_stop',
  'ck_dive_participations__o2_percent',
  'ck_dive_participations__tank_volume_l',
  'ck_dive_participations__tank_material',
  'ck_dive_participations__start_pressure_bar',
  'ck_dive_participations__end_pressure_bar',
  'ck_dive_participations__suit_type',
  'ck_dive_participations__suit_thickness_mm',
  'ck_dive_participations__weight_kg',
  'pk_dive_buddies',
  'fk_dive_buddies__owner_id',
  'fk_dive_buddies__owner_id_participation_id',
  'fk_dive_buddies__owner_id_buddy_id',
  'pk_dive_observations',
  'fk_dive_observations__participation_id',
  'uq_dive_observations__participation_id_label',
  'ck_dive_observations__position',
  'ck_dive_observations__label',
  'ck_dive_observations__count',
];

const INDEXES: Record<string, string> = {
  idx_dive_sites__owner_id_updated_at_id: '(owner_id, updated_at, id)',
  idx_buddies__owner_id_updated_at_id: '(owner_id, updated_at, id)',
  idx_buddies__linked_diver_id: '(linked_diver_id) WHERE (linked_diver_id IS NOT NULL)',
  uq_buddies__owner_id_linked_diver_id:
    '(owner_id, linked_diver_id) WHERE ((linked_diver_id IS NOT NULL) AND (deleted_at IS NULL))',
  idx_dive_events__creator_id_updated_at_id: '(creator_id, updated_at, id)',
  idx_dive_events__creator_id_site_id: '(creator_id, site_id)',
  idx_dive_participations__diver_id_dive_event_id:
    '(diver_id, dive_event_id) WHERE (deleted_at IS NULL)',
  idx_dive_participations__diver_id_updated_at_id: '(diver_id, updated_at, id)',
  idx_dive_buddies__owner_id_buddy_id: '(owner_id, buddy_id)',
};

const TRIGGERS = [
  'trg_buddies__set_updated_at',
  'trg_certification_levels__set_updated_at',
  'trg_dive_buddies__touch_participation',
  'trg_dive_events__set_updated_at',
  'trg_dive_observations__touch_participation',
  'trg_dive_participations__set_updated_at',
  'trg_dive_sites__set_updated_at',
  'trg_divers__set_updated_at',
];

/** Composite FKs: exact column order and delete rule, as specified. */
/** Columns added by `AddDiveDetailFields`: all nullable, none with a default (D-22, RG-30). */
const DETAIL_COLUMNS: Record<string, string> = {
  'dive_sites.area': 'text',
  'buddies.certification_level_id': 'uuid',
  'dive_events.entry_type': 'text',
  'dive_events.time_of_day': 'text',
  'dive_events.weather': 'text',
  'dive_events.air_temperature_c': 'numeric(3,1)',
  'dive_events.sea_state': 'text',
  'dive_events.current_strength': 'text',
  'dive_events.dive_center': 'text',
  'dive_participations.surface_water_temperature_c': 'numeric(3,1)',
  'dive_participations.safety_stop_duration_min': 'smallint',
  'dive_participations.safety_stop_depth_m': 'numeric(3,1)',
  'dive_participations.is_repetitive': 'boolean',
  'dive_participations.o2_percent': 'numeric(4,1)',
  'dive_participations.tank_volume_l': 'numeric(3,1)',
  'dive_participations.tank_material': 'text',
  'dive_participations.start_pressure_bar': 'smallint',
  'dive_participations.end_pressure_bar': 'smallint',
  'dive_participations.suit_type': 'text',
  'dive_participations.suit_thickness_mm': 'numeric(3,1)',
  'dive_participations.weight_kg': 'numeric(3,1)',
};

const COMPOSITE_FOREIGN_KEYS: Record<string, string> = {
  fk_dive_events__creator_id_site_id:
    'FOREIGN KEY (creator_id, site_id) REFERENCES dive_sites(owner_id, id) ON DELETE RESTRICT',
  fk_dive_buddies__owner_id_participation_id:
    'FOREIGN KEY (owner_id, participation_id) REFERENCES dive_participations(diver_id, id) ON DELETE CASCADE',
  fk_dive_buddies__owner_id_buddy_id:
    'FOREIGN KEY (owner_id, buddy_id) REFERENCES buddies(owner_id, id) ON DELETE CASCADE',
};

/** Columns made nullable by `AllowDiveSiteWithoutPosition` (D-23). */
const SITE_POSITION_COLUMNS = ['region', 'latitude', 'longitude'];

interface NameRow {
  name: string;
}

describe('dive log schema migrations', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    // Other suites may run first: drop their rows (the seed itself is never re-inserted).
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function names(sql: string): Promise<string[]> {
    const rows = await selectRows<NameRow>(dataSource, sql);
    return rows.map((row) => row.name).sort();
  }

  it('creates every constraint with its name', async () => {
    const constraints = await names(
      "SELECT conname AS name FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conrelid <> 'migrations'::regclass AND contype <> 'n'",
    );
    expect(constraints).toEqual([...CONSTRAINTS].sort());
  });

  it('creates the composite FKs in the specified column order', async () => {
    const rows = await selectRows<{ name: string; definition: string }>(
      dataSource,
      'SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = ANY($1)',
      [Object.keys(COMPOSITE_FOREIGN_KEYS)],
    );
    expect(Object.fromEntries(rows.map((row) => [row.name, row.definition]))).toEqual(
      COMPOSITE_FOREIGN_KEYS,
    );
  });

  it('creates every index with its name, columns and predicate', async () => {
    const rows = await selectRows<{ name: string; definition: string }>(
      dataSource,
      "SELECT indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)",
      [Object.keys(INDEXES)],
    );
    const definitions = Object.fromEntries(
      rows.map((row) => [row.name, row.definition.replace(/^.* USING btree /, '')]),
    );
    expect(definitions).toEqual(INDEXES);
  });

  it('creates the triggers', async () => {
    expect(await names('SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal')).toEqual(
      TRIGGERS,
    );
  });

  it('gives server-side defaults: uuidv7() for divers and levels, none for client ids and stops_ok', async () => {
    const rows = await selectRows<{ column: string; default: string | null }>(
      dataSource,
      `SELECT table_name || '.' || column_name AS column, column_default AS default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name IN ('id', 'stops_ok')`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.column, row.default]))).toEqual({
      'certification_levels.id': 'uuidv7()',
      'divers.id': 'uuidv7()',
      'dive_sites.id': null,
      'buddies.id': null,
      'dive_events.id': null,
      'dive_participations.id': null,
      'dive_participations.stops_ok': null,
      'migrations.id': "nextval('migrations_id_seq'::regclass)",
    });
  });

  it('adds the detail columns nullable, without default', async () => {
    const rows = await selectRows<{
      column: string;
      type: string;
      nullable: boolean;
      default: string | null;
    }>(
      dataSource,
      `SELECT c.relname || '.' || a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type,
              NOT a.attnotnull AS nullable, pg_get_expr(d.adbin, d.adrelid) AS default
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE c.relname || '.' || a.attname = ANY($1)`,
      [Object.keys(DETAIL_COLUMNS)],
    );
    expect(
      Object.fromEntries(rows.map((row) => [row.column, [row.type, row.nullable, row.default]])),
    ).toEqual(
      Object.fromEntries(
        Object.entries(DETAIL_COLUMNS).map(([column, type]) => [column, [type, true, null]]),
      ),
    );
  });

  it('defines the observation keys and FKs as specified', async () => {
    const rows = await selectRows<{ name: string; definition: string }>(
      dataSource,
      'SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = ANY($1)',
      [
        [
          'pk_dive_observations',
          'uq_dive_observations__participation_id_label',
          'fk_dive_observations__participation_id',
          'fk_buddies__certification_level_id',
        ],
      ],
    );
    expect(Object.fromEntries(rows.map((row) => [row.name, row.definition]))).toEqual({
      pk_dive_observations: 'PRIMARY KEY (participation_id, "position")',
      uq_dive_observations__participation_id_label: 'UNIQUE (participation_id, label)',
      fk_dive_observations__participation_id:
        'FOREIGN KEY (participation_id) REFERENCES dive_participations(id) ON DELETE CASCADE',
      fk_buddies__certification_level_id:
        'FOREIGN KEY (certification_level_id) REFERENCES certification_levels(id) ON DELETE RESTRICT',
    });
  });

  it('seeds exactly the four FFESSM levels', async () => {
    const levels = await selectRows<unknown>(
      dataSource,
      'SELECT agency, code, label, rank, is_active FROM certification_levels ORDER BY rank',
    );
    expect(levels).toEqual([
      { agency: 'FFESSM', code: 'N1', label: 'Niveau 1', rank: 10, is_active: true },
      { agency: 'FFESSM', code: 'N2', label: 'Niveau 2', rank: 20, is_active: true },
      { agency: 'FFESSM', code: 'N3', label: 'Niveau 3', rank: 30, is_active: true },
      { agency: 'FFESSM', code: 'N4', label: 'Niveau 4', rank: 40, is_active: true },
    ]);
  });

  async function sitePositionNullability(): Promise<Record<string, boolean>> {
    const rows = await selectRows<{ name: string; nullable: boolean }>(
      dataSource,
      `SELECT column_name AS name, is_nullable = 'YES' AS nullable FROM information_schema.columns
        WHERE table_name = 'dive_sites' AND column_name = ANY($1)`,
      [SITE_POSITION_COLUMNS],
    );
    return Object.fromEntries(rows.map((row) => [row.name, row.nullable]));
  }

  it('makes the region and the position of a site nullable (D-23)', async () => {
    expect(await sitePositionNullability()).toEqual({
      region: true,
      latitude: true,
      longitude: true,
    });
  });

  it('reverts AllowDiveSiteWithoutPosition only once every site has a region and a position', async () => {
    const fixtures = new Fixtures(dataSource);
    const diver = await fixtures.diver();
    const site = await fixtures.site(diver.id, { region: null, latitude: null, longitude: null });

    await expect(dataSource.undoLastMigration({ transaction: 'all' })).rejects.toThrow(
      'some dive sites have no region or no position',
    );
    expect(await sitePositionNullability()).toEqual({
      region: true,
      latitude: true,
      longitude: true,
    });

    await dataSource.query(
      "UPDATE dive_sites SET region = 'Var', latitude = 43, longitude = 6 WHERE id = $1",
      [site.id],
    );
    await dataSource.undoLastMigration({ transaction: 'all' });
    expect(await sitePositionNullability()).toEqual({
      region: false,
      latitude: false,
      longitude: false,
    });
    expect(
      await names(
        "SELECT conname AS name FROM pg_constraint WHERE conname = 'ck_dive_sites__position'",
      ),
    ).toEqual([]);

    await resetDatabase(dataSource);
    await dataSource.runMigrations({ transaction: 'each' });
    expect(await sitePositionNullability()).toEqual({
      region: true,
      latitude: true,
      longitude: true,
    });
  });

  it('reverts AddDiveDetailFields (after the later migration), keeping the shared trigger function, then migrates again', async () => {
    // AllowDiveSiteWithoutPosition comes after it: reverted first.
    await dataSource.undoLastMigration({ transaction: 'all' });
    await dataSource.undoLastMigration({ transaction: 'all' });

    expect(
      await names(
        "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dive_observations'",
      ),
    ).toEqual([]);
    expect(
      await selectRows<NameRow>(
        dataSource,
        `SELECT table_name || '.' || column_name AS name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name || '.' || column_name = ANY($1)`,
        [Object.keys(DETAIL_COLUMNS)],
      ),
    ).toEqual([]);
    // The function belongs to InitDiveLogSchema: still there, still used by the dive team.
    expect(
      await names(
        "SELECT proname AS name FROM pg_proc WHERE pronamespace = 'public'::regnamespace",
      ),
    ).toEqual(['set_updated_at', 'touch_participation_on_buddies_change']);
    expect(await names('SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal')).toEqual(
      TRIGGERS.filter((trigger) => trigger !== 'trg_dive_observations__touch_participation'),
    );

    await dataSource.runMigrations({ transaction: 'each' });
    expect(await names('SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal')).toEqual(
      TRIGGERS,
    );
  });

  // Last: leaves the schema migrated again.
  it('reverts completely, then migrates again', async () => {
    for (let reverted = 0; reverted < dataSource.migrations.length; reverted += 1) {
      await dataSource.undoLastMigration({ transaction: 'all' });
    }
    expect(
      await names(
        "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'",
      ),
    ).toEqual([]);
    expect(
      await names(
        "SELECT proname AS name FROM pg_proc WHERE pronamespace = 'public'::regnamespace",
      ),
    ).toEqual([]);

    await dataSource.runMigrations({ transaction: 'each' });
    expect(await names('SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal')).toEqual(
      TRIGGERS,
    );
  });
});
