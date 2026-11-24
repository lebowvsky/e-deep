import { randomBytes } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { Account } from '../../src/modules/accounts/account.entity';
import type { AuthEvent } from '../../src/modules/auth/auth-event.entity';
import type { Session } from '../../src/modules/auth/session.entity';
import type { Consent } from '../../src/modules/consents/consent.entity';
import { Diver } from '../../src/modules/divers/diver.entity';
import { Fixtures } from './support/fixtures';
import { selectRows, violating } from './support/sql';
import { createTestDataSource, resetDatabase } from './support/test-database';

const AUTH_TABLES = ['accounts', 'auth_events', 'consents', 'sessions'];

interface NameRow {
  name: string;
}

describe('auth schema', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  async function names(sql: string, parameters: readonly unknown[] = []): Promise<string[]> {
    const rows = await selectRows<NameRow>(dataSource, sql, parameters);
    return rows.map((row) => row.name).sort();
  }

  async function lastMigration(): Promise<string | undefined> {
    const [row] = await selectRows<NameRow>(
      dataSource,
      'SELECT name FROM migrations ORDER BY id DESC LIMIT 1',
    );
    return row?.name;
  }

  async function count(table: string): Promise<number> {
    const [row] = await selectRows<{ count: number }>(
      dataSource,
      `SELECT count(*)::int AS count FROM "${table}"`,
    );
    return row?.count ?? 0;
  }

  describe('accounts (CreateAuthSchema)', () => {
    it.each([
      ['an email with upper case', { email: 'Alex@example.test' }],
      ['an email with spaces around', { email: ' alex@example.test ' }],
      ['an email without local part', { email: '@example.test' }],
      ['an email without @', { email: 'alex.example.test' }],
      ['an email over 254 characters', { email: `${'a'.repeat(250)}@x.io` }],
    ])('refuses %s', async (_case, values: Partial<Account>) => {
      const diver = await fixtures.diver();
      await expect(fixtures.account(diver.id, values)).rejects.toEqual(
        violating('ck_accounts__email'),
      );
    });

    it.each(['plain-text', '$argon2i$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA', '$2b$12$abcdef'])(
      'refuses a password hash that is not Argon2id: %s',
      async (passwordHash) => {
        const diver = await fixtures.diver();
        await expect(fixtures.account(diver.id, { passwordHash })).rejects.toEqual(
          violating('ck_accounts__password_hash'),
        );
      },
    );

    it('refuses an unknown role', async () => {
      await expect(fixtures.account(null, { role: 'owner' as Account['role'] })).rejects.toEqual(
        violating('ck_accounts__role'),
      );
    });

    it.each(['support', 'admin'] as const)('refuses a %s account with a diver', async (role) => {
      const diver = await fixtures.diver();
      await expect(fixtures.account(diver.id, { role })).rejects.toEqual(
        violating('ck_accounts__diver_role'),
      );
    });

    it('refuses a diver account without diver', async () => {
      await expect(fixtures.account(null, { role: 'diver' })).rejects.toEqual(
        violating('ck_accounts__diver_role'),
      );
    });

    it('accepts a diver account and staff accounts, with the server-side defaults', async () => {
      const diver = await fixtures.diver();
      await dataSource.query(
        `INSERT INTO accounts (diver_id, email, password_hash) VALUES ($1, 'alex@example.test', $2)`,
        [diver.id, '$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA'],
      );
      await fixtures.account(null, { role: 'support', email: 'support@example.test' });
      await fixtures.account(null, { role: 'admin', email: 'a@b' });

      const [account] = await selectRows<{
        id: string;
        role: string;
        email_verified_at: Date | null;
        password_changed_at: Date | null;
        updated_at: Date | null;
      }>(
        dataSource,
        'SELECT id, role, email_verified_at, password_changed_at, updated_at FROM accounts WHERE diver_id = $1',
        [diver.id],
      );
      expect(account).toMatchObject({ role: 'diver', email_verified_at: null });
      expect(account?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
      expect(account?.password_changed_at).toBeInstanceOf(Date);
      expect(account?.updated_at).toBeInstanceOf(Date);
    });

    it('refuses a second account with the same email', async () => {
      const [first, second] = [await fixtures.diver(), await fixtures.diver()];
      await fixtures.account(first.id, { email: 'alex@example.test' });
      await expect(fixtures.account(second.id, { email: 'alex@example.test' })).rejects.toEqual(
        violating('uq_accounts__email'),
      );
    });

    it('refuses a second account for the same diver', async () => {
      const diver = await fixtures.diver();
      await fixtures.account(diver.id);
      await expect(fixtures.account(diver.id)).rejects.toEqual(violating('uq_accounts__diver_id'));
    });

    it('sets updated_at on update, ignoring a provided value', async () => {
      const account = await fixtures.account(null);
      await dataSource.query(
        "UPDATE accounts SET email = 'renamed@example.test', updated_at = '2000-01-01' WHERE id = $1",
        [account.id],
      );
      const [row] = await selectRows<{ moved: boolean }>(
        dataSource,
        'SELECT updated_at > $2 AS moved FROM accounts WHERE id = $1',
        [account.id, account.updatedAt],
      );
      expect(row?.moved).toBe(true);
    });
  });

  describe('sessions', () => {
    it.each([31, 33, 0])('refuses a token hash of %i bytes', async (length) => {
      const account = await fixtures.account(null);
      await expect(
        fixtures.session(account.id, { tokenHash: randomBytes(length) }),
      ).rejects.toEqual(violating('ck_sessions__token_hash'));
    });

    it('refuses an unknown audience', async () => {
      const account = await fixtures.account(null);
      await expect(
        fixtures.session(account.id, { audience: 'mobile' as Session['audience'] }),
      ).rejects.toEqual(violating('ck_sessions__audience'));
    });

    it('refuses the same token hash twice', async () => {
      const account = await fixtures.account(null);
      const tokenHash = randomBytes(32);
      await fixtures.session(account.id, { tokenHash });
      await expect(fixtures.session(account.id, { tokenHash })).rejects.toEqual(
        violating('uq_sessions__token_hash'),
      );
    });

    it('stores a 32-byte hash and both audiences, with created_at and last_seen_at defaults', async () => {
      const account = await fixtures.account(null);
      const tokenHash = randomBytes(32);
      const web = await fixtures.session(account.id, { tokenHash });
      await fixtures.session(account.id, { audience: 'admin' });

      expect(web.tokenHash.equals(tokenHash)).toBe(true);
      expect(web.createdAt).toBeInstanceOf(Date);
      expect(web.lastSeenAt).toBeInstanceOf(Date);
    });
  });

  describe('consents', () => {
    it('refuses a withdrawal before the grant', async () => {
      const diver = await fixtures.diver();
      await expect(
        fixtures.consent(diver.id, {
          grantedAt: new Date('2026-11-20T10:00:00.000Z'),
          withdrawnAt: new Date('2026-11-20T09:59:59.000Z'),
        }),
      ).rejects.toEqual(violating('ck_consents__withdrawn_after_granted'));
    });

    it('refuses an unknown purpose', async () => {
      const diver = await fixtures.diver();
      await expect(
        fixtures.consent(diver.id, { purpose: 'marketing' as Consent['purpose'] }),
      ).rejects.toEqual(violating('ck_consents__purpose'));
    });

    it.each(['', 'x'.repeat(33)])('refuses the policy version "%s"', async (policyVersion) => {
      const diver = await fixtures.diver();
      await expect(fixtures.consent(diver.id, { policyVersion })).rejects.toEqual(
        violating('ck_consents__policy_version'),
      );
    });

    it('refuses a second live consent for the same purpose', async () => {
      const diver = await fixtures.diver();
      await fixtures.consent(diver.id);
      await expect(fixtures.consent(diver.id, { policyVersion: '2027-01' })).rejects.toEqual(
        violating('uq_consents__live'),
      );
    });

    it('keeps the history: a withdrawn consent and a live one', async () => {
      const diver = await fixtures.diver();
      const other = await fixtures.diver();
      await fixtures.consent(diver.id, {
        policyVersion: '2026-01',
        grantedAt: new Date('2026-01-10T10:00:00.000Z'),
        withdrawnAt: new Date('2026-11-20T10:00:00.000Z'),
      });
      await fixtures.consent(diver.id, { policyVersion: '2026-11' });
      await fixtures.consent(other.id);

      expect(await count('consents')).toBe(3);
    });
  });

  describe('auth_events', () => {
    it('refuses an unknown type', async () => {
      const account = await fixtures.account(null);
      await expect(
        fixtures.authEvent(account.id, { type: 'login_maybe' as AuthEvent['type'] }),
      ).rejects.toEqual(violating('ck_auth_events__type'));
    });

    it('accepts account_created (AddAccountCreatedAuthEvent)', async () => {
      const account = await fixtures.account((await fixtures.diver()).id);
      const event = await fixtures.authEvent(account.id, { type: 'account_created' });
      expect(event).toMatchObject({ accountId: account.id, type: 'account_created' });
    });

    it('records account_deleted without account', async () => {
      const event = await fixtures.authEvent(null, { type: 'account_deleted' });
      expect(event).toMatchObject({ accountId: null, type: 'account_deleted' });
      expect(event.occurredAt).toBeInstanceOf(Date);
    });
  });

  it('cascades the erasure of a diver (art. 17) to the account, sessions, consents and auth events', async () => {
    const diver = await fixtures.diver();
    const other = await fixtures.diver();
    const account = await fixtures.account(diver.id);
    const otherAccount = await fixtures.account(other.id);
    await fixtures.session(account.id);
    await fixtures.session(account.id, { audience: 'admin' });
    await fixtures.consent(diver.id);
    await fixtures.authEvent(account.id);
    await fixtures.session(otherAccount.id);
    await fixtures.consent(other.id);
    await fixtures.authEvent(otherAccount.id);
    await fixtures.authEvent(null, { type: 'account_deleted' });

    await dataSource.manager.delete(Diver, { id: diver.id });

    expect(await count('accounts')).toBe(1);
    expect(await count('sessions')).toBe(1);
    expect(await count('consents')).toBe(1);
    // The other diver's event and the one without account remain.
    expect(await count('auth_events')).toBe(2);
  });

  it('cascades the deletion of a staff account to its sessions and auth events', async () => {
    const account = await fixtures.account(null);
    await fixtures.session(account.id, { audience: 'admin' });
    await fixtures.authEvent(account.id);

    await dataSource.query('DELETE FROM accounts WHERE id = $1', [account.id]);

    expect(await count('sessions')).toBe(0);
    expect(await count('auth_events')).toBe(0);
  });

  describe('incomplete diver profile (AllowIncompleteDiverProfile)', () => {
    it('accepts a diver without last name nor level', async () => {
      const diver = await fixtures.incompleteDiver();
      expect(diver).toMatchObject({ lastName: null, certificationLevelId: null });
    });

    it('still refuses a blank last name', async () => {
      await expect(fixtures.diver({ lastName: '  ' })).rejects.toEqual(
        violating('ck_divers__last_name'),
      );
    });

    it('still requires the level of a participation (snapshot, D-09)', async () => {
      const diver = await fixtures.incompleteDiver();
      const site = await fixtures.site(diver.id);
      const event = await fixtures.event(diver.id, site.id);
      await expect(
        dataSource.query(
          `INSERT INTO dive_participations (id, dive_event_id, diver_id, certification_level_id, max_depth_m, duration_min, gas_mix, stops_ok)
           VALUES (uuidv7(), $1, $2, NULL, 20, 40, 'AIR', true)`,
          [event.id, diver.id],
        ),
      ).rejects.toEqual(
        expect.objectContaining({
          driverError: expect.objectContaining({
            code: '23502',
            column: 'certification_level_id',
          }) as unknown,
        }),
      );
    });
  });

  describe('reverts', () => {
    // Leaves the schema migrated for the next suites, even when a test fails midway.
    afterEach(async () => {
      await dataSource.runMigrations({ transaction: 'each' });
    });

    async function diverColumns(): Promise<Record<string, boolean>> {
      const rows = await selectRows<{ name: string; nullable: boolean }>(
        dataSource,
        `SELECT column_name AS name, is_nullable = 'YES' AS nullable FROM information_schema.columns
          WHERE table_name = 'divers' AND column_name IN ('last_name', 'certification_level_id')`,
      );
      return Object.fromEntries(rows.map((row) => [row.name, row.nullable]));
    }

    async function lastNameCheck(): Promise<string | undefined> {
      const [row] = await selectRows<{ definition: string }>(
        dataSource,
        "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'ck_divers__last_name'",
      );
      return row?.definition;
    }

    async function authEventTypeCheck(): Promise<string | undefined> {
      const [row] = await selectRows<{ definition: string }>(
        dataSource,
        "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'ck_auth_events__type'",
      );
      return row?.definition;
    }

    it('reverts AddAccountCreatedAuthEvent only once no account_created event is left, then migrates again', async () => {
      expect(await lastMigration()).toBe('AddAccountCreatedAuthEvent1795505541116');
      const account = await fixtures.account((await fixtures.diver()).id);
      const created = await fixtures.authEvent(account.id, { type: 'account_created' });
      await fixtures.authEvent(account.id, { type: 'login_succeeded' });

      await expect(dataSource.undoLastMigration({ transaction: 'all' })).rejects.toThrow(
        'some auth events are account_created',
      );
      expect(await lastMigration()).toBe('AddAccountCreatedAuthEvent1795505541116');
      expect(await authEventTypeCheck()).toContain("'account_created'");

      await dataSource.query('DELETE FROM auth_events WHERE id = $1', [created.id]);
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(await lastMigration()).toBe('AllowIncompleteDiverProfile1795191584720');
      expect(await authEventTypeCheck()).not.toContain('account_created');
      await expect(fixtures.authEvent(account.id, { type: 'account_created' })).rejects.toEqual(
        violating('ck_auth_events__type'),
      );
      expect(await count('auth_events')).toBe(1);

      await dataSource.runMigrations({ transaction: 'each' });
      expect(await lastMigration()).toBe('AddAccountCreatedAuthEvent1795505541116');
      expect(await authEventTypeCheck()).toContain("'account_created'");
    });

    it('reverts AllowIncompleteDiverProfile only once every profile is complete, then migrates again', async () => {
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(await lastMigration()).toBe('AllowIncompleteDiverProfile1795191584720');
      const incomplete = await fixtures.incompleteDiver();

      await expect(dataSource.undoLastMigration({ transaction: 'all' })).rejects.toThrow(
        'some divers have no last name or no certification level',
      );
      expect(await diverColumns()).toEqual({ last_name: true, certification_level_id: true });

      await dataSource.query(
        "UPDATE divers SET last_name = 'Martin', certification_level_id = $2 WHERE id = $1",
        [incomplete.id, await fixtures.levelId()],
      );
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(await lastMigration()).toBe('CreateAuthSchema1795191490987');
      expect(await diverColumns()).toEqual({ last_name: false, certification_level_id: false });
      expect(await lastNameCheck()).toBe(
        'CHECK (((char_length(btrim(last_name)) >= 1) AND (char_length(btrim(last_name)) <= 100)))',
      );

      await dataSource.runMigrations({ transaction: 'each' });
      expect(await diverColumns()).toEqual({ last_name: true, certification_level_id: true });
      expect(await lastNameCheck()).toBe(
        'CHECK (((last_name IS NULL) OR ((char_length(btrim(last_name)) >= 1) AND (char_length(btrim(last_name)) <= 100))))',
      );
    });

    it('reverts CreateAuthSchema alone, keeping the dive log and set_updated_at(), then migrates again', async () => {
      const diver = await fixtures.diver();
      await fixtures.account(diver.id);
      await dataSource.undoLastMigration({ transaction: 'all' });
      await dataSource.undoLastMigration({ transaction: 'all' });

      await dataSource.undoLastMigration({ transaction: 'all' });

      expect(await lastMigration()).toBe('AddDiveSiteDetails1795125645653');
      expect(
        await names(
          "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
          [AUTH_TABLES],
        ),
      ).toEqual([]);
      expect(
        await names("SELECT tgname AS name FROM pg_trigger WHERE tgname LIKE 'trg_accounts__%'"),
      ).toEqual([]);
      expect(
        await names(
          "SELECT proname AS name FROM pg_proc WHERE pronamespace = 'public'::regnamespace",
        ),
      ).toEqual(['set_updated_at', 'touch_participation_on_buddies_change']);
      expect(await count('divers')).toBe(1);

      await dataSource.runMigrations({ transaction: 'each' });
      expect(await lastMigration()).toBe('AddAccountCreatedAuthEvent1795505541116');
      expect(
        await names(
          "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
          [AUTH_TABLES],
        ),
      ).toEqual(AUTH_TABLES);
    });
  });
});
