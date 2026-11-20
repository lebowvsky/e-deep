import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Authentication (D33, D36, D38, D40): accounts, opaque sessions, consents and auth events. Purely
 * additive, no existing table changes; the `down()` loses the accounts. Every constraint and index
 * is named in the entities.
 */
export class CreateAuthSchema1795191490987 implements MigrationInterface {
    name = 'CreateAuthSchema1795191490987'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "accounts" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "id" uuid NOT NULL DEFAULT uuidv7(), "diver_id" uuid, "email" text NOT NULL, "password_hash" text NOT NULL, "role" text NOT NULL DEFAULT 'diver', "email_verified_at" TIMESTAMP WITH TIME ZONE, "password_changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_accounts__diver_id" UNIQUE ("diver_id"), CONSTRAINT "uq_accounts__email" UNIQUE ("email"), CONSTRAINT "ck_accounts__diver_role" CHECK ((role = 'diver') = (diver_id IS NOT NULL)), CONSTRAINT "ck_accounts__role" CHECK (role IN ('diver', 'support', 'admin')), CONSTRAINT "ck_accounts__password_hash" CHECK (starts_with(password_hash, '$argon2id$')), CONSTRAINT "ck_accounts__email" CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254 AND position('@' in email) > 1), CONSTRAINT "pk_accounts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "auth_events" ("id" uuid NOT NULL DEFAULT uuidv7(), "account_id" uuid, "type" text NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "ck_auth_events__type" CHECK (type IN ('login_succeeded', 'login_failed', 'login_throttled', 'logout', 'sessions_revoked', 'password_changed', 'password_reset_by_operator', 'consent_granted', 'account_deleted')), CONSTRAINT "pk_auth_events" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_auth_events__occurred_at" ON "auth_events"  ("occurred_at") `);
        await queryRunner.query(`CREATE INDEX "idx_auth_events__account_id" ON "auth_events"  ("account_id") `);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuidv7(), "account_id" uuid NOT NULL, "token_hash" bytea NOT NULL, "audience" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "uq_sessions__token_hash" UNIQUE ("token_hash"), CONSTRAINT "ck_sessions__audience" CHECK (audience IN ('web', 'admin')), CONSTRAINT "ck_sessions__token_hash" CHECK (octet_length(token_hash) = 32), CONSTRAINT "pk_sessions" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_sessions__expires_at" ON "sessions"  ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "idx_sessions__account_id" ON "sessions"  ("account_id") `);
        await queryRunner.query(`CREATE TABLE "consents" ("id" uuid NOT NULL DEFAULT uuidv7(), "diver_id" uuid NOT NULL, "purpose" text NOT NULL, "policy_version" text NOT NULL, "granted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "withdrawn_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "ck_consents__withdrawn_after_granted" CHECK (withdrawn_at IS NULL OR withdrawn_at >= granted_at), CONSTRAINT "ck_consents__policy_version" CHECK (char_length(policy_version) BETWEEN 1 AND 32), CONSTRAINT "ck_consents__purpose" CHECK (purpose IN ('health_data_processing')), CONSTRAINT "pk_consents" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_consents__diver_id" ON "consents"  ("diver_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_consents__live" ON "consents"  ("diver_id", "purpose") WHERE withdrawn_at IS NULL`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "fk_accounts__diver_id" FOREIGN KEY ("diver_id") REFERENCES "divers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth_events" ADD CONSTRAINT "fk_auth_events__account_id" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions__account_id" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "consents" ADD CONSTRAINT "fk_consents__diver_id" FOREIGN KEY ("diver_id") REFERENCES "divers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // ---- Hand-written SQL (not expressible with TypeORM decorators) ----
        // `updated_at` is owned by the server, like on every timestamped table. Reuses the function
        // of InitDiveLogSchema, which the `down()` never drops.
        await queryRunner.query(`CREATE TRIGGER trg_accounts__set_updated_at BEFORE INSERT OR UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER trg_accounts__set_updated_at ON accounts`);
        await queryRunner.query(`ALTER TABLE "consents" DROP CONSTRAINT "fk_consents__diver_id"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "fk_sessions__account_id"`);
        await queryRunner.query(`ALTER TABLE "auth_events" DROP CONSTRAINT "fk_auth_events__account_id"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "fk_accounts__diver_id"`);
        await queryRunner.query(`DROP INDEX "public"."uq_consents__live"`);
        await queryRunner.query(`DROP INDEX "public"."idx_consents__diver_id"`);
        await queryRunner.query(`DROP TABLE "consents"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sessions__account_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sessions__expires_at"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "public"."idx_auth_events__account_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_auth_events__occurred_at"`);
        await queryRunner.query(`DROP TABLE "auth_events"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
    }

}
