import type { DataSource } from 'typeorm';
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
});
