import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDiveSiteLocality1794590554546 implements MigrationInterface {
    name = 'AddDiveSiteLocality1794590554546'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD "locality" text`);
        await queryRunner.query(`ALTER TABLE "dive_sites" ADD CONSTRAINT "ck_dive_sites__locality" CHECK (locality IS NULL OR char_length(btrim(locality)) BETWEEN 1 AND 120)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP CONSTRAINT "ck_dive_sites__locality"`);
        await queryRunner.query(`ALTER TABLE "dive_sites" DROP COLUMN "locality"`);
    }

}
