import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * D36: the minimal sign-up creates a diver without last name nor level (incomplete profile); the
 * level is set at `/welcome` (D38). No backfill: the existing divers are complete.
 * `dive_participations.certification_level_id` stays NOT NULL: a dive is only written after
 * `/welcome`, with its level snapshot (D-09).
 */
export class AllowIncompleteDiverProfile1795191584720 implements MigrationInterface {
    name = 'AllowIncompleteDiverProfile1795191584720'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // The generator also dropped and re-created `fk_divers__certification_level_id` around the
        // nullability change: removed by hand, the FK is unchanged.
        await queryRunner.query(`ALTER TABLE "divers" ALTER COLUMN "last_name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "divers" ALTER COLUMN "certification_level_id" DROP NOT NULL`);
        // Written by hand: the generator compares CHECKs by name and misses a changed expression.
        await queryRunner.query(`ALTER TABLE "divers" DROP CONSTRAINT "ck_divers__last_name"`);
        await queryRunner.query(`ALTER TABLE "divers" ADD CONSTRAINT "ck_divers__last_name" CHECK (last_name IS NULL OR char_length(btrim(last_name)) BETWEEN 1 AND 100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No last name nor level can be invented for an incomplete profile: complete it first.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM divers WHERE last_name IS NULL OR certification_level_id IS NULL) THEN
                    RAISE EXCEPTION 'Cannot revert AllowIncompleteDiverProfile: some divers have no last name or no certification level';
                END IF;
            END
            $$`);
        await queryRunner.query(`ALTER TABLE "divers" DROP CONSTRAINT "ck_divers__last_name"`);
        await queryRunner.query(`ALTER TABLE "divers" ADD CONSTRAINT "ck_divers__last_name" CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 100)`);
        await queryRunner.query(`ALTER TABLE "divers" ALTER COLUMN "certification_level_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "divers" ALTER COLUMN "last_name" SET NOT NULL`);
    }

}
