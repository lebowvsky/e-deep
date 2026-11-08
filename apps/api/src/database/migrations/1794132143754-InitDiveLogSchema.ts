import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables whose `updated_at` is set by the `set_updated_at()` trigger (every table but `dive_buddies`). */
const SET_UPDATED_AT_TABLES = [
  'certification_levels',
  'divers',
  'dive_sites',
  'buddies',
  'dive_events',
  'dive_participations',
] as const;

export class InitDiveLogSchema1794132143754 implements MigrationInterface {
  name = 'InitDiveLogSchema1794132143754';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "certification_levels" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "id" uuid NOT NULL DEFAULT uuidv7(), "agency" text NOT NULL, "code" text NOT NULL, "label" text NOT NULL, "rank" smallint NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "uq_certification_levels__agency_code" UNIQUE ("agency", "code"), CONSTRAINT "ck_certification_levels__rank" CHECK (rank > 0), CONSTRAINT "ck_certification_levels__label" CHECK (char_length(btrim(label)) BETWEEN 1 AND 120), CONSTRAINT "ck_certification_levels__code" CHECK (char_length(btrim(code)) BETWEEN 1 AND 40), CONSTRAINT "ck_certification_levels__agency" CHECK (char_length(btrim(agency)) BETWEEN 1 AND 40), CONSTRAINT "pk_certification_levels" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "divers" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "id" uuid NOT NULL DEFAULT uuidv7(), "first_name" text NOT NULL, "last_name" text NOT NULL, "certification_level_id" uuid NOT NULL, "avatar_url" text, CONSTRAINT "ck_divers__avatar_url" CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048), CONSTRAINT "ck_divers__last_name" CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 100), CONSTRAINT "ck_divers__first_name" CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 100), CONSTRAINT "pk_divers" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "buddies" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "owner_id" uuid NOT NULL, "first_name" text NOT NULL, "last_name" text NOT NULL, "linked_diver_id" uuid, CONSTRAINT "uq_buddies__owner_id_id" UNIQUE ("owner_id", "id"), CONSTRAINT "ck_buddies__not_self" CHECK (linked_diver_id IS NULL OR linked_diver_id <> owner_id), CONSTRAINT "ck_buddies__last_name" CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 100), CONSTRAINT "ck_buddies__first_name" CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 100), CONSTRAINT "pk_buddies" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_buddies__linked_diver_id" ON "buddies"  ("linked_diver_id") WHERE linked_diver_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_buddies__owner_id_updated_at_id" ON "buddies"  ("owner_id", "updated_at", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_buddies__owner_id_linked_diver_id" ON "buddies"  ("owner_id", "linked_diver_id") WHERE linked_diver_id IS NOT NULL AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "dive_sites" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "owner_id" uuid NOT NULL, "name" text NOT NULL, "region" text NOT NULL, "latitude" numeric(8,6) NOT NULL, "longitude" numeric(9,6) NOT NULL, CONSTRAINT "uq_dive_sites__owner_id_id" UNIQUE ("owner_id", "id"), CONSTRAINT "ck_dive_sites__longitude" CHECK (longitude BETWEEN -180 AND 180), CONSTRAINT "ck_dive_sites__latitude" CHECK (latitude BETWEEN -90 AND 90), CONSTRAINT "ck_dive_sites__region" CHECK (char_length(btrim(region)) BETWEEN 1 AND 120), CONSTRAINT "ck_dive_sites__name" CHECK (char_length(btrim(name)) BETWEEN 1 AND 120), CONSTRAINT "pk_dive_sites" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dive_sites__owner_id_updated_at_id" ON "dive_sites"  ("owner_id", "updated_at", "id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dive_events" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "creator_id" uuid NOT NULL, "site_id" uuid NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "utc_offset_minutes" smallint NOT NULL, CONSTRAINT "ck_dive_events__utc_offset_minutes" CHECK (utc_offset_minutes BETWEEN -720 AND 840), CONSTRAINT "pk_dive_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dive_events__creator_id_site_id" ON "dive_events"  ("creator_id", "site_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dive_events__creator_id_updated_at_id" ON "dive_events"  ("creator_id", "updated_at", "id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dive_participations" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "dive_event_id" uuid NOT NULL, "diver_id" uuid NOT NULL, "certification_level_id" uuid NOT NULL, "max_depth_m" numeric(4,1) NOT NULL, "duration_min" smallint NOT NULL, "water_temperature_c" numeric(3,1), "visibility_m" smallint, "gas_mix" text NOT NULL, "has_decompression" boolean NOT NULL DEFAULT false, "stops_ok" boolean NOT NULL, "notes" text, CONSTRAINT "uq_dive_participations__diver_id_id" UNIQUE ("diver_id", "id"), CONSTRAINT "uq_dive_participations__dive_event_id_diver_id" UNIQUE ("dive_event_id", "diver_id"), CONSTRAINT "ck_dive_participations__notes" CHECK (notes IS NULL OR char_length(notes) <= 5000), CONSTRAINT "ck_dive_participations__gas_mix" CHECK (gas_mix IN ('AIR', 'NITROX32', 'NITROX36', 'OTHER')), CONSTRAINT "ck_dive_participations__visibility_m" CHECK (visibility_m IS NULL OR visibility_m BETWEEN 0 AND 100), CONSTRAINT "ck_dive_participations__water_temperature_c" CHECK (water_temperature_c IS NULL OR water_temperature_c BETWEEN -5 AND 45), CONSTRAINT "ck_dive_participations__duration_min" CHECK (duration_min > 0 AND duration_min <= 1440), CONSTRAINT "ck_dive_participations__max_depth_m" CHECK (max_depth_m > 0 AND max_depth_m <= 350), CONSTRAINT "pk_dive_participations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dive_participations__diver_id_updated_at_id" ON "dive_participations"  ("diver_id", "updated_at", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dive_participations__diver_id_dive_event_id" ON "dive_participations"  ("diver_id", "dive_event_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "dive_buddies" ("participation_id" uuid NOT NULL, "buddy_id" uuid NOT NULL, "owner_id" uuid NOT NULL, CONSTRAINT "pk_dive_buddies" PRIMARY KEY ("participation_id", "buddy_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dive_buddies__owner_id_buddy_id" ON "dive_buddies"  ("owner_id", "buddy_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "divers" ADD CONSTRAINT "fk_divers__certification_level_id" FOREIGN KEY ("certification_level_id") REFERENCES "certification_levels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "buddies" ADD CONSTRAINT "fk_buddies__owner_id" FOREIGN KEY ("owner_id") REFERENCES "divers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "buddies" ADD CONSTRAINT "fk_buddies__linked_diver_id" FOREIGN KEY ("linked_diver_id") REFERENCES "divers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_sites" ADD CONSTRAINT "fk_dive_sites__owner_id" FOREIGN KEY ("owner_id") REFERENCES "divers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_events" ADD CONSTRAINT "fk_dive_events__creator_id" FOREIGN KEY ("creator_id") REFERENCES "divers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_events" ADD CONSTRAINT "fk_dive_events__creator_id_site_id" FOREIGN KEY ("creator_id", "site_id") REFERENCES "dive_sites"("owner_id","id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_participations" ADD CONSTRAINT "fk_dive_participations__dive_event_id" FOREIGN KEY ("dive_event_id") REFERENCES "dive_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_participations" ADD CONSTRAINT "fk_dive_participations__diver_id" FOREIGN KEY ("diver_id") REFERENCES "divers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_participations" ADD CONSTRAINT "fk_dive_participations__certification_level_id" FOREIGN KEY ("certification_level_id") REFERENCES "certification_levels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_buddies" ADD CONSTRAINT "fk_dive_buddies__owner_id" FOREIGN KEY ("owner_id") REFERENCES "divers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_buddies" ADD CONSTRAINT "fk_dive_buddies__owner_id_participation_id" FOREIGN KEY ("owner_id", "participation_id") REFERENCES "dive_participations"("diver_id","id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_buddies" ADD CONSTRAINT "fk_dive_buddies__owner_id_buddy_id" FOREIGN KEY ("owner_id", "buddy_id") REFERENCES "buddies"("owner_id","id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ---- Hand-written SQL (not expressible with TypeORM decorators) ----
    // The three composite FKs above were generated as (id, owner); rewritten as (owner, id), as specified.

    // updated_at is owned by the server (synchronisation cursor).
    await queryRunner.query(`CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$`);
    for (const table of SET_UPDATED_AT_TABLES) {
      await queryRunner.query(
        `CREATE TRIGGER trg_${table}__set_updated_at BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
      );
    }

    // A dive team change brings the participation back into the sync pull. During a cascade
    // (account deletion, purge) the participation is already gone: the UPDATE touches no row
    // (D-12 e, covered by the db tests).
    await queryRunner.query(`CREATE FUNCTION touch_participation_on_buddies_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dive_participations SET updated_at = clock_timestamp()
   WHERE id = COALESCE(NEW.participation_id, OLD.participation_id);
  RETURN NULL;
END $$`);
    await queryRunner.query(
      `CREATE TRIGGER trg_dive_buddies__touch_participation AFTER INSERT OR DELETE ON dive_buddies FOR EACH ROW EXECUTE FUNCTION touch_participation_on_buddies_change()`,
    );

    // Reference data: only the levels attested by the sources (the D-09 complementary list awaits validation).
    await queryRunner.query(`INSERT INTO certification_levels (agency, code, label, rank) VALUES
  ('FFESSM', 'N1', 'Niveau 1', 10),
  ('FFESSM', 'N2', 'Niveau 2', 20),
  ('FFESSM', 'N3', 'Niveau 3', 30),
  ('FFESSM', 'N4', 'Niveau 4', 40)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER trg_dive_buddies__touch_participation ON dive_buddies`);
    for (const table of [...SET_UPDATED_AT_TABLES].reverse()) {
      await queryRunner.query(`DROP TRIGGER trg_${table}__set_updated_at ON ${table}`);
    }
    await queryRunner.query(`DROP FUNCTION touch_participation_on_buddies_change()`);
    await queryRunner.query(`DROP FUNCTION set_updated_at()`);
    await queryRunner.query(
      `ALTER TABLE "dive_buddies" DROP CONSTRAINT "fk_dive_buddies__owner_id_buddy_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_buddies" DROP CONSTRAINT "fk_dive_buddies__owner_id_participation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_buddies" DROP CONSTRAINT "fk_dive_buddies__owner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_participations" DROP CONSTRAINT "fk_dive_participations__certification_level_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_participations" DROP CONSTRAINT "fk_dive_participations__diver_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_participations" DROP CONSTRAINT "fk_dive_participations__dive_event_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_events" DROP CONSTRAINT "fk_dive_events__creator_id_site_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dive_events" DROP CONSTRAINT "fk_dive_events__creator_id"`,
    );
    await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "fk_dive_sites__owner_id"`);
    await queryRunner.query(`ALTER TABLE "buddies" DROP CONSTRAINT "fk_buddies__linked_diver_id"`);
    await queryRunner.query(`ALTER TABLE "buddies" DROP CONSTRAINT "fk_buddies__owner_id"`);
    await queryRunner.query(
      `ALTER TABLE "divers" DROP CONSTRAINT "fk_divers__certification_level_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_dive_buddies__owner_id_buddy_id"`);
    await queryRunner.query(`DROP TABLE "dive_buddies"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_dive_participations__diver_id_dive_event_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_dive_participations__diver_id_updated_at_id"`,
    );
    await queryRunner.query(`DROP TABLE "dive_participations"`);
    await queryRunner.query(`DROP INDEX "public"."idx_dive_events__creator_id_updated_at_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_dive_events__creator_id_site_id"`);
    await queryRunner.query(`DROP TABLE "dive_events"`);
    await queryRunner.query(`DROP INDEX "public"."idx_dive_sites__owner_id_updated_at_id"`);
    await queryRunner.query(`DROP TABLE "dive_sites"`);
    await queryRunner.query(`DROP INDEX "public"."uq_buddies__owner_id_linked_diver_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_buddies__owner_id_updated_at_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_buddies__linked_diver_id"`);
    await queryRunner.query(`DROP TABLE "buddies"`);
    await queryRunner.query(`DROP TABLE "divers"`);
    // Seed removed once no table references the levels any more (RESTRICT FKs), so that a
    // non-empty database can be reverted too.
    await queryRunner.query(
      `DELETE FROM certification_levels WHERE agency = 'FFESSM' AND code IN ('N1', 'N2', 'N3', 'N4')`,
    );
    await queryRunner.query(`DROP TABLE "certification_levels"`);
  }
}
