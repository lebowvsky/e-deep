import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * D-27 to D-30: type, depths and access notes of a site (nullable, no default), its origin
 * (`created_via`, immutable) and the target of the merge that deleted it (`merged_into_id`).
 */
export class AddDiveSiteDetails1795125645653 implements MigrationInterface {
    name = 'AddDiveSiteDetails1795125645653'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD "type" text`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD "depth_min_m" numeric(4,1)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD "depth_max_m" numeric(4,1)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD "access_notes" text`);
        // Written by hand: added nullable, backfilled with the rule the front applied until now (a
        // site with a position comes from the map), then required.
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD "created_via" text`);
        await queryRunner.query(`UPDATE "dive_sites" SET "created_via" = CASE WHEN latitude IS NULL THEN 'quick' ELSE 'full' END`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ALTER COLUMN "created_via" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD "merged_into_id" uuid`);
        await queryRunner.query(`CREATE INDEX "idx_dive_sites__owner_id_merged_into_id" ON "dive_sites"  ("owner_id", "merged_into_id") WHERE merged_into_id IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__merged_into_id_not_self" CHECK (merged_into_id IS NULL OR merged_into_id <> id)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__merged_into_id_tombstone" CHECK (merged_into_id IS NULL OR deleted_at IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__created_via" CHECK (created_via IN ('quick', 'full'))`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__access_notes" CHECK (access_notes IS NULL OR char_length(btrim(access_notes)) BETWEEN 1 AND 2000)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__depth_range" CHECK (depth_min_m IS NULL OR depth_max_m IS NULL OR depth_min_m <= depth_max_m)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__depth_max_m" CHECK (depth_max_m IS NULL OR (depth_max_m > 0 AND depth_max_m <= 350))`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__depth_min_m" CHECK (depth_min_m IS NULL OR depth_min_m BETWEEN 0 AND 350)`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__type" CHECK (type IS NULL OR type IN ('tombant', 'epave', 'sec', 'grotte', 'herbier', 'autre'))`);
        // Generated as (id, owner); rewritten as (owner, id) like the other composite FKs.
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "fk_dive_sites__owner_id_merged_into_id" FOREIGN KEY ("owner_id", "merged_into_id") REFERENCES "dive_sites"("owner_id","id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    // The values entered in the new columns are lost (assumed, evolution-sites.md).
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "fk_dive_sites__owner_id_merged_into_id"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__type"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__depth_min_m"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__depth_max_m"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__depth_range"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__access_notes"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__created_via"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__merged_into_id_tombstone"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__merged_into_id_not_self"`);
        await queryRunner.query(`DROP INDEX "public"."idx_dive_sites__owner_id_merged_into_id"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP COLUMN "merged_into_id"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP COLUMN "created_via"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP COLUMN "access_notes"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP COLUMN "depth_max_m"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP COLUMN "depth_min_m"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP COLUMN "type"`);
    }

}
