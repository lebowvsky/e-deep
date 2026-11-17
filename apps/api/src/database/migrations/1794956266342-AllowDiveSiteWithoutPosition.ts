import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * D-23: a site created by its name alone has no region nor position yet. `NULL` = not entered;
 * latitude and longitude go together (`ck_dive_sites__position`).
 */
export class AllowDiveSiteWithoutPosition1794956266342 implements MigrationInterface {
    name = 'AllowDiveSiteWithoutPosition1794956266342'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dive_sites" ALTER COLUMN "region" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ALTER COLUMN "latitude" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ALTER COLUMN "longitude" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__position" CHECK ((latitude IS NULL) = (longitude IS NULL))`);
        // Written by hand: the generator compares CHECKs by name and misses a changed expression.
        // Same behaviour (a NULL CHECK passes), but the definitions now match the entity.
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__region"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__region" CHECK (region IS NULL OR char_length(btrim(region)) BETWEEN 1 AND 120)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__latitude"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__latitude" CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__longitude"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__longitude" CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No value can be invented for a site without region or position: complete them first.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM dive_sites WHERE region IS NULL OR latitude IS NULL OR longitude IS NULL) THEN
                    RAISE EXCEPTION 'Cannot revert AllowDiveSiteWithoutPosition: some dive sites have no region or no position';
                END IF;
            END
            $$`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__longitude"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__longitude" CHECK (longitude BETWEEN -180 AND 180)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__latitude"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__latitude" CHECK (latitude BETWEEN -90 AND 90)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__region"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__region" CHECK (char_length(btrim(region)) BETWEEN 1 AND 120)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__position"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ALTER COLUMN "longitude" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ALTER COLUMN "latitude" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ALTER COLUMN "region" SET NOT NULL`);
    }

}
