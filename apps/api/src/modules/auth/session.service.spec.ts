import type { DataSource } from 'typeorm';
import type { Clock } from '../../common/time/clock';
import type { Account } from '../accounts/account.entity';
import type { Session } from './session.entity';
import { SessionService } from './session.service';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = new Date('2026-11-24T10:00:00.000Z');
const DIVER_ACCOUNT = { id: 'account-1', diverId: 'diver-1', role: 'diver' } as Account;
const STAFF_ACCOUNT = { id: 'account-1', diverId: null, role: 'admin' } as Account;

/** In-memory sessions behind the few manager calls the service makes. */
function setup({ swapRoles = false }: { swapRoles?: boolean } = {}) {
  let now = START;
  const clock: Clock = { now: () => now };
  const rows: Session[] = [];
  const execute = jest.fn().mockResolvedValue({ affected: 1 });
  const queryBuilder = {
    update: () => queryBuilder,
    set: () => queryBuilder,
    where: () => queryBuilder,
    andWhere: () => queryBuilder,
    execute,
  };
  const manager = {
    insert: jest.fn((_entity: unknown, values: Omit<Session, 'id'>) => {
      const id = `session-${rows.length + 1}`;
      rows.push({ ...values, id });
      return Promise.resolve({ identifiers: [{ id }] });
    }),
    findOne: jest.fn((_entity: unknown, { where }: { where: { tokenHash: Buffer } }) => {
      const row = rows.find((session) => session.tokenHash.equals(where.tokenHash));
      if (row === undefined) return Promise.resolve(null);
      const isAdmin = (row.audience === 'admin') !== swapRoles;
      return Promise.resolve({ ...row, account: isAdmin ? STAFF_ACCOUNT : DIVER_ACCOUNT });
    }),
    createQueryBuilder: () => queryBuilder,
  };
  const dataSource = { manager } as unknown as DataSource;
  const service = new SessionService(dataSource, clock);
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  return { service, rows, findOne: manager.findOne, execute, advance };
}

describe('SessionService', () => {
  describe('create', () => {
    it('returns a 32-byte base64url token and stores only its SHA-256', async () => {
      const { service, rows } = setup();

      const issued = await service.create('account-1', 'web', { rememberMe: true });

      expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tokenHash).toHaveLength(32);
      expect(rows[0]?.tokenHash.toString('base64url')).not.toBe(issued.token);
      expect(JSON.stringify(rows[0])).not.toContain(issued.token);
    });

    it.each<[string, 'web' | 'admin', boolean, number, boolean]>([
      ['web with « Rester connecté »', 'web', true, 180 * DAY, true],
      ['web without « Rester connecté »', 'web', false, 24 * HOUR, false],
      ['admin, whatever the option', 'admin', true, 8 * HOUR, false],
    ])(
      '%s: absolute expiry and cookie persistence',
      async (_label, audience, rememberMe, lifetime, persistent) => {
        const { service, rows } = setup();

        const issued = await service.create('account-1', audience, { rememberMe });

        expect(issued.expiresAt).toEqual(new Date(START.getTime() + lifetime));
        expect(issued.persistent).toBe(persistent);
        expect(rows[0]).toMatchObject({ createdAt: START, lastSeenAt: START, audience });
      },
    );
  });

  describe('resolve', () => {
    it('reads a live session with its account', async () => {
      const { service } = setup();
      const { token, sessionId } = await service.create('account-1', 'web', { rememberMe: true });

      await expect(service.resolve(token, 'web')).resolves.toMatchObject({
        sessionId,
        accountId: 'account-1',
        diverId: 'diver-1',
        role: 'diver',
        audience: 'web',
      });
    });

    it('refuses the other audience, an unknown or a malformed token', async () => {
      const { service, findOne } = setup();
      const { token } = await service.create('account-1', 'web', { rememberMe: true });

      await expect(service.resolve(token, 'admin')).resolves.toBeNull();
      await expect(service.resolve('A'.repeat(43), 'web')).resolves.toBeNull();
      await expect(service.resolve('not a token', 'web')).resolves.toBeNull();
      // A malformed token does not even reach the database.
      expect(findOne).toHaveBeenCalledTimes(2);
    });

    it('refuses a session whose account role does not match the audience', async () => {
      const { service } = setup({ swapRoles: true });
      const web = await service.create('account-1', 'web', { rememberMe: true });
      const admin = await service.create('account-1', 'admin', { rememberMe: false });

      await expect(service.resolve(web.token, 'web')).resolves.toBeNull();
      await expect(service.resolve(admin.token, 'admin')).resolves.toBeNull();
    });

    it('expires a long web session at its absolute expiry, even when active', async () => {
      const { service, rows, advance } = setup();
      const { token } = await service.create('account-1', 'web', { rememberMe: true });

      advance(180 * DAY - 1);
      rows[0]!.lastSeenAt = new Date(START.getTime() + 180 * DAY - HOUR);
      await expect(service.resolve(token, 'web')).resolves.not.toBeNull();

      advance(1);
      await expect(service.resolve(token, 'web')).resolves.toBeNull();
    });

    it('expires a web session after 30 days of inactivity', async () => {
      const { service, advance } = setup();
      const { token } = await service.create('account-1', 'web', { rememberMe: true });

      advance(30 * DAY - 1);
      await expect(service.resolve(token, 'web')).resolves.not.toBeNull();

      advance(1);
      await expect(service.resolve(token, 'web')).resolves.toBeNull();
    });

    it('ends a session without « Rester connecté » after 24 h, even when active', async () => {
      const { service, rows, advance } = setup();
      const { token } = await service.create('account-1', 'web', { rememberMe: false });

      advance(24 * HOUR - 1);
      rows[0]!.lastSeenAt = new Date(START.getTime() + 23 * HOUR);
      await expect(service.resolve(token, 'web')).resolves.not.toBeNull();

      advance(1);
      await expect(service.resolve(token, 'web')).resolves.toBeNull();
    });

    it('expires an admin session after 30 minutes of inactivity and 8 h at most', async () => {
      const idle = setup();
      const first = await idle.service.create('account-1', 'admin', { rememberMe: false });
      idle.advance(30 * 60_000);
      await expect(idle.service.resolve(first.token, 'admin')).resolves.toBeNull();

      const active = setup();
      const second = await active.service.create('account-1', 'admin', { rememberMe: false });
      active.advance(8 * HOUR);
      active.rows[0]!.lastSeenAt = new Date(START.getTime() + 8 * HOUR - 60_000);
      await expect(active.service.resolve(second.token, 'admin')).resolves.toBeNull();
    });
  });

  describe('touch', () => {
    it('writes last_seen_at at most once an hour on the web', async () => {
      const { service, execute, advance } = setup();
      const { token } = await service.create('account-1', 'web', { rememberMe: true });

      advance(HOUR - 1);
      const early = await service.resolve(token, 'web');
      await expect(service.touch(early!)).resolves.toBe(false);
      expect(execute).not.toHaveBeenCalled();

      advance(1);
      const due = await service.resolve(token, 'web');
      await expect(service.touch(due!)).resolves.toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('writes last_seen_at at most once a minute on the admin', async () => {
      const { service, execute, advance } = setup();
      const { token } = await service.create('account-1', 'admin', { rememberMe: false });

      advance(59_999);
      await expect(service.touch((await service.resolve(token, 'admin'))!)).resolves.toBe(false);
      advance(1);
      await expect(service.touch((await service.resolve(token, 'admin'))!)).resolves.toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
