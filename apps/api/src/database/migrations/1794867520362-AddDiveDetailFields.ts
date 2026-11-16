import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fields of the dive detail (D-13 to D-22): type and conditions on the event, profile, gas and
 * equipment on the participation, area of the site, current level of a buddy, species observations.
 * Every new column is nullable without default (`NULL` = not entered); no backfill.
 */
export class AddDiveDetailFields1794867520362 implements MigrationInterface {
    name = 'AddDiveDetailFields1794867520362'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dive_observations" ("participation_id" uuid NOT NULL, "position" smallint NOT NULL, "label" text NOT NULL, "count" smallint, CONSTRAINT "uq_dive_observations__participation_id_label" UNIQUE ("participation_id", "label"), CONSTRAINT "ck_dive_observations__count" CHECK (count IS NULL OR count BETWEEN 1 AND 9999), CONSTRAINT "ck_dive_observations__label" CHECK (char_length(btrim(label)) BETWEEN 1 AND 80), CONSTRAINT "ck_dive_observations__position" CHECK (position BETWEEN 0 AND 49), CONSTRAINT "pk_dive_observations" PRIMARY KEY ("participation_id", "position"))`);
        await queryRunner.query(`ALTER TABLE "buddies" ADD "certification_level_id" uuid`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD "area" text`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD "entry_type" text`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD "time_of_day" text`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD "weather" text`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD "air_temperature_c" numeric(3,1)`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD "sea_state" text`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD "current_strength" text`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD "dive_center" text`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "surface_water_temperature_c" numeric(3,1)`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "safety_stop_duration_min" smallint`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "safety_stop_depth_m" numeric(3,1)`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "is_repetitive" boolean`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "o2_percent" numeric(4,1)`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "tank_volume_l" numeric(3,1)`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "tank_material" text`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "start_pressure_bar" smallint`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "end_pressure_bar" smallint`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "suit_type" text`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "suit_thickness_mm" numeric(3,1)`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD "weight_kg" numeric(3,1)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__area" CHECK (area IS NULL OR char_length(btrim(area)) BETWEEN 1 AND 120)`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD CONSTRAINT "ck_dive_events__dive_center" CHECK (dive_center IS NULL OR char_length(btrim(dive_center)) BETWEEN 1 AND 120)`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD CONSTRAINT "ck_dive_events__current_strength" CHECK (current_strength IS NULL OR current_strength IN ('NONE', 'WEAK', 'MODERATE', 'STRONG'))`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD CONSTRAINT "ck_dive_events__sea_state" CHECK (sea_state IS NULL OR sea_state IN ('CALM', 'SLIGHT', 'MODERATE', 'ROUGH'))`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD CONSTRAINT "ck_dive_events__air_temperature_c" CHECK (air_temperature_c IS NULL OR air_temperature_c BETWEEN -40 AND 60)`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD CONSTRAINT "ck_dive_events__weather" CHECK (weather IS NULL OR weather IN ('SUNNY', 'CLOUDY', 'OVERCAST', 'RAIN'))`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD CONSTRAINT "ck_dive_events__time_of_day" CHECK (time_of_day IS NULL OR time_of_day IN ('DAY', 'NIGHT'))`);
        await queryRunner.query(`ALTER TABLE "dive_events" ADD CONSTRAINT "ck_dive_events__entry_type" CHECK (entry_type IS NULL OR entry_type IN ('BOAT', 'SHORE'))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__weight_kg" CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 40)`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__suit_thickness_mm" CHECK (suit_thickness_mm IS NULL OR (suit_thickness_mm > 0 AND suit_thickness_mm <= 15))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__suit_type" CHECK (suit_type IS NULL OR suit_type IN ('WET', 'SEMI_DRY', 'DRY'))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__end_pressure_bar" CHECK (end_pressure_bar IS NULL OR (end_pressure_bar BETWEEN 0 AND 350 AND (start_pressure_bar IS NULL OR end_pressure_bar <= start_pressure_bar)))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__start_pressure_bar" CHECK (start_pressure_bar IS NULL OR (start_pressure_bar > 0 AND start_pressure_bar <= 350))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__tank_material" CHECK (tank_material IS NULL OR tank_material IN ('STEEL', 'ALUMINIUM'))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__tank_volume_l" CHECK (tank_volume_l IS NULL OR (tank_volume_l > 0 AND tank_volume_l <= 30))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__o2_percent" CHECK (o2_percent IS NULL OR (gas_mix = 'OTHER' AND o2_percent > 0 AND o2_percent <= 100))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__safety_stop" CHECK ((safety_stop_duration_min IS NULL) = (safety_stop_depth_m IS NULL))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__safety_stop_depth_m" CHECK (safety_stop_depth_m IS NULL OR (safety_stop_depth_m > 0 AND safety_stop_depth_m <= 20 AND safety_stop_depth_m <= max_depth_m))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__safety_stop_duration_min" CHECK (safety_stop_duration_min IS NULL OR (safety_stop_duration_min > 0 AND safety_stop_duration_min <= 60 AND safety_stop_duration_min < duration_min))`);
        await queryRunner.query(`ALTER TABLE "dive_participations" ADD CONSTRAINT "ck_dive_participations__surface_water_temperature_c" CHECK (surface_water_temperature_c IS NULL OR surface_water_temperature_c BETWEEN -5 AND 45)`);
        await queryRunner.query(`ALTER TABLE "buddies" ADD CONSTRAINT "fk_buddies__certification_level_id" FOREIGN KEY ("certification_level_id") REFERENCES "certification_levels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dive_observations" ADD CONSTRAINT "fk_dive_observations__participation_id" FOREIGN KEY ("participation_id") REFERENCES "dive_participations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // ---- Hand-written SQL (not expressible with TypeORM decorators) ----
        // A change of observations brings the participation back into the sync pull. Reuses the
        // function of InitDiveLogSchema, which only reads `participation_id` (D-19).
        await queryRunner.query(`CREATE TRIGGER trg_dive_observations__touch_participation AFTER INSERT OR UPDATE OR DELETE ON dive_observations FOR EACH ROW EXECUTE FUNCTION touch_participation_on_buddies_change()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Trigger first, then the table, then the columns and constraints. The function
        // touch_participation_on_buddies_change() belongs to InitDiveLogSchema: never dropped here.
        await queryRunner.query(`DROP TRIGGER trg_dive_observations__touch_participation ON dive_observations`);
        await queryRunner.query(`ALTER TABLE "dive_observations" DROP CONSTRAINT "fk_dive_observations__participation_id"`);
        await queryRunner.query(`DROP TABLE "dive_observations"`);
        await queryRunner.query(`ALTER TABLE "buddies" DROP CONSTRAINT "fk_buddies__certification_level_id"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__surface_water_temperature_c"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__safety_stop_duration_min"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__safety_stop_depth_m"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__safety_stop"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__o2_percent"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__tank_volume_l"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__tank_material"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__start_pressure_bar"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__end_pressure_bar"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__suit_type"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__suit_thickness_mm"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP CONSTRAINT "ck_dive_participations__weight_kg"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP CONSTRAINT "ck_dive_events__entry_type"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP CONSTRAINT "ck_dive_events__time_of_day"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP CONSTRAINT "ck_dive_events__weather"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP CONSTRAINT "ck_dive_events__air_temperature_c"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP CONSTRAINT "ck_dive_events__sea_state"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP CONSTRAINT "ck_dive_events__current_strength"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP CONSTRAINT "ck_dive_events__dive_center"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__area"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "weight_kg"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "suit_thickness_mm"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "suit_type"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "end_pressure_bar"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "start_pressure_bar"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "tank_material"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "tank_volume_l"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "o2_percent"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "is_repetitive"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "safety_stop_depth_m"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "safety_stop_duration_min"`);
        await queryRunner.query(`ALTER TABLE "dive_participations" DROP COLUMN "surface_water_temperature_c"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP COLUMN "dive_center"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP COLUMN "current_strength"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP COLUMN "sea_state"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP COLUMN "air_temperature_c"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP COLUMN "weather"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP COLUMN "time_of_day"`);
        await queryRunner.query(`ALTER TABLE "dive_events" DROP COLUMN "entry_type"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP COLUMN "area"`);
        await queryRunner.query(`ALTER TABLE "buddies" DROP COLUMN "certification_level_id"`);
    }

}
