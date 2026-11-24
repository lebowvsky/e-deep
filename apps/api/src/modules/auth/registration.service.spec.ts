import type { DataSource, EntityManager } from 'typeorm';
import { RegistrationClosedError } from '../../common/errors/domain-errors';
import type { DiversService } from '../divers/divers.service';
import type { AuthEventsService } from './auth-events.service';
import type { LoginThrottle } from './login-throttle';
import type { PasswordHasher } from './password/password-hasher';
import type { PasswordPolicy } from './password/password-policy';
import { RegistrationService } from './registration.service';
import type { SessionService } from './session.service';

describe('RegistrationService', () => {
  it('refuses every sign-up while REGISTRATION_ENABLED is off, before any work', async () => {
    const transaction = jest.fn();
    const hash = jest.fn();
    const consume = jest.fn();
    const service = new RegistrationService(
      { transaction } as unknown as DataSource,
      { registrationEnabled: false },
      {} as DiversService,
      { hash } as unknown as PasswordHasher,
      {} as PasswordPolicy,
      { consume } as unknown as LoginThrottle,
      {} as SessionService,
      {} as AuthEventsService,
    );

    await expect(
      service.register({
        firstName: 'Lou',
        email: 'lou@example.test',
        password: 'a long enough passphrase',
        ip: '203.0.113.7',
      }),
    ).rejects.toThrow(RegistrationClosedError);
    expect(consume).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('revokes the presented web cookies inside the sign-up transaction', async () => {
    const manager = {
      insert: jest.fn().mockResolvedValue(undefined),
      findOneByOrFail: jest.fn().mockResolvedValue({
        id: 'account-1',
        email: 'lou@example.test',
        role: 'diver',
        diverId: 'diver-1',
      }),
    };
    const sessions = {
      revokeIn: jest.fn().mockResolvedValue(null),
      createIn: jest.fn().mockResolvedValue({ sessionId: 'session-1' }),
    };
    const service = new RegistrationService(
      {
        transaction: (run: (m: EntityManager) => Promise<unknown>) =>
          run(manager as unknown as EntityManager),
      } as unknown as DataSource,
      { registrationEnabled: true },
      {
        createIncompleteIn: jest.fn().mockResolvedValue({ id: 'diver-1' }),
      } as unknown as DiversService,
      { hash: jest.fn().mockResolvedValue('$argon2id$hash') } as unknown as PasswordHasher,
      { assertAcceptable: jest.fn() } as unknown as PasswordPolicy,
      { consume: jest.fn().mockReturnValue({ allowed: true }) } as unknown as LoginThrottle,
      sessions as unknown as SessionService,
      { recordIn: jest.fn().mockResolvedValue(undefined) } as unknown as AuthEventsService,
    );

    await service.register({
      firstName: 'Lou',
      email: 'lou@example.test',
      password: 'a long enough passphrase',
      ip: '203.0.113.7',
      replacedTokens: ['old-1', 'old-2'],
    });

    expect(sessions.revokeIn.mock.calls).toEqual([
      [manager, 'old-1', 'web'],
      [manager, 'old-2', 'web'],
    ]);
    expect(sessions.revokeIn.mock.invocationCallOrder[1]).toBeLessThan(
      sessions.createIn.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
