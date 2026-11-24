import { IsString, MinLength } from 'class-validator';
import { DatabaseEnvironment } from '../../config/environment';
import { PASSWORD_MIN_LENGTH } from '../../modules/auth/password/password-policy';

/**
 * Variables of the dev seed (`pnpm db:seed`): the database ones, plus the password of the seeded
 * accounts (D44). Required by the seed only: the TypeORM CLI, the migrations and the db tests load
 * `DatabaseEnvironment` and never need it.
 */
export class SeedEnvironment extends DatabaseEnvironment {
  /**
   * Password of every seeded account (`marine@example.test`…), no default: no secret in the
   * repository. At least 15 characters here; the seed then applies the full password policy (D35)
   * against each seeded identity. Never logged.
   */
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  SEED_PASSWORD: string;
}
