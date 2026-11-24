import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * D40: the sign-up gets its own security event, `account_created` (it was traced as a
 * `login_succeeded`). Written by hand: the generator compares CHECKs by name and misses a changed
 * expression (same remark as `AllowDiveSiteWithoutPosition`).
 */
export class AddAccountCreatedAuthEvent1795505541116 implements MigrationInterface {
    name = 'AddAccountCreatedAuthEvent1795505541116'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_events" DROP CONSTRAINT "ck_auth_events__type"`);
        await queryRunner.query(`ALTER TABLE "auth_events" ADD CONSTRAINT "ck_auth_events__type" CHECK (type IN ('login_succeeded', 'login_failed', 'login_throttled', 'logout', 'sessions_revoked', 'password_changed', 'password_reset_by_operator', 'consent_granted', 'account_deleted', 'account_created'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No other type can stand for a sign-up without rewriting the trail: delete those rows first.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM auth_events WHERE type = 'account_created') THEN
                    RAISE EXCEPTION 'Cannot revert AddAccountCreatedAuthEvent: some auth events are account_created';
                END IF;
            END
            $$`);
        await queryRunner.query(`ALTER TABLE "auth_events" DROP CONSTRAINT "ck_auth_events__type"`);
        await queryRunner.query(`ALTER TABLE "auth_events" ADD CONSTRAINT "ck_auth_events__type" CHECK (type IN ('login_succeeded', 'login_failed', 'login_throttled', 'logout', 'sessions_revoked', 'password_changed', 'password_reset_by_operator', 'consent_granted', 'account_deleted'))`);
    }

}
