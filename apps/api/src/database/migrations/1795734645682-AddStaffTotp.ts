import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * D42: the staff second factor. `accounts.totp_secret` (AES-256-GCM, `TotpSecretCipher`) and
 * `accounts.totp_last_used_step` (anti-replay), both `NULL` for a diver
 * (`ck_accounts__totp_staff_only`). A staff account created before this migration has no secret
 * and cannot sign in until `account:reset-totp`. The `totp_reset` auth event is added by hand:
 * the generator compares CHECKs by name and misses a changed expression.
 *
 * The `down()` drops the secrets (every staff account must be enrolled again) and fails while a
 * `totp_reset` event is left.
 */
export class AddStaffTotp1795734645682 implements MigrationInterface {
    name = 'AddStaffTotp1795734645682'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounts" ADD "totp_secret" text`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "totp_last_used_step" bigint`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "ck_accounts__totp_staff_only" CHECK (role <> 'diver' OR (totp_secret IS NULL AND totp_last_used_step IS NULL))`);
        await queryRunner.query(`ALTER TABLE "auth_events" DROP CONSTRAINT "ck_auth_events__type"`);
        await queryRunner.query(`ALTER TABLE "auth_events" ADD CONSTRAINT "ck_auth_events__type" CHECK (type IN ('login_succeeded', 'login_failed', 'login_throttled', 'logout', 'sessions_revoked', 'password_changed', 'password_reset_by_operator', 'consent_granted', 'account_deleted', 'account_created', 'totp_reset'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM auth_events WHERE type = 'totp_reset') THEN
                    RAISE EXCEPTION 'Cannot revert AddStaffTotp: some auth events are totp_reset';
                END IF;
            END
            $$`);
        await queryRunner.query(`ALTER TABLE "auth_events" DROP CONSTRAINT "ck_auth_events__type"`);
        await queryRunner.query(`ALTER TABLE "auth_events" ADD CONSTRAINT "ck_auth_events__type" CHECK (type IN ('login_succeeded', 'login_failed', 'login_throttled', 'logout', 'sessions_revoked', 'password_changed', 'password_reset_by_operator', 'consent_granted', 'account_deleted', 'account_created'))`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "ck_accounts__totp_staff_only"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "totp_last_used_step"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "totp_secret"`);
    }

}
