import type { DataSource } from 'typeorm';
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
  'pk_buddies',
  'fk_buddies__owner_id',
  'fk_buddies__linked_diver_id',
  'uq_buddies__owner_id_id',
  'ck_buddies__first_name',
  'ck_buddies__last_name',
  'ck_buddies__not_self',
  'pk_dive_events',
  'fk_dive_events__creator_id',
  'fk_dive_events__creator_id_site_id',
  'ck_dive_events__utc_offset_minutes',
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
  'pk_dive_buddies',
  'fk_dive_buddies__owner_id',
  'fk_dive_buddies__owner_id_participation_id',
  'fk_dive_buddies__owner_id_buddy_id',
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
  'trg_dive_participations__set_updated_at',
  'trg_dive_sites__set_updated_at',
  'trg_divers__set_updated_at',
];

/** Composite FKs: exact column order and delete rule, as specified. */
const COMPOSITE_FOREIGN_KEYS: Record<string, string> = {
  fk_dive_events__creator_id_site_id:
    'FOREIGN KEY (creator_id, site_id) REFERENCES dive_sites(owner_id, id) ON DELETE RESTRICT',
  fk_dive_buddies__owner_id_participation_id:
    'FOREIGN KEY (owner_id, participation_id) REFERENCES dive_participations(diver_id, id) ON DELETE CASCADE',
  fk_dive_buddies__owner_id_buddy_id:
    'FOREIGN KEY (owner_id, buddy_id) REFERENCES buddies(owner_id, id) ON DELETE CASCADE',
};

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
