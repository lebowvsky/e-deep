import { Transform, plainToInstance, type ClassConstructor } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  validateSync,
  type ValidationError,
} from 'class-validator';
import { DEFAULT_PURGE_HORIZON_DAYS } from '../common/sync/sync-settings';

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const MAX_PURGE_HORIZON_DAYS = 3_650;
const MAX_TRUST_PROXY_HOPS = 10;

export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

/** Variables required to reach the database. Shared by the Nest app and the TypeORM CLI. */
export class DatabaseEnvironment {
  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string;

  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  DATABASE_PORT: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_USER: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME: string;
}

/** Every variable the API reads. Validated once at startup by `ConfigModule`. */
export class EnvironmentVariables extends DatabaseEnvironment {
  /** Required: `development`, `test` or `production`. */
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV: NodeEnvironment;

  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  PORT: number = 3000;

  /**
   * Browser origins accepted by the `OriginGuard` on unsafe methods when the request has no
   * `Sec-Fetch-Site: same-origin` (D34). Comma-separated list in the environment, e.g.
   * `http://localhost:5173,http://localhost:5174`. Replaces `CORS_ORIGINS`: there is no CORS.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? splitCommaSeparatedList(value) : value,
  )
  @ArrayNotEmpty()
  @IsUrl(
    { require_tld: false, require_protocol: true, protocols: ['http', 'https'] },
    { each: true },
  )
  // The browser `Origin` header never has a path or a trailing slash: compared as exact strings.
  @Matches(/^https?:\/\/[^/?#]+$/, { each: true, message: 'each entry must be a bare origin' })
  ALLOWED_ORIGINS: string[];

  /** Purge horizon of the sync tombstones, in days (D-12). Optional. */
  @IsInt()
  @Min(1)
  @Max(MAX_PURGE_HORIZON_DAYS)
  SYNC_PURGE_HORIZON_DAYS: number = DEFAULT_PURGE_HORIZON_DAYS;

  /**
   * Number of reverse-proxy hops trusted by Express (`trust proxy`), so that `req.ip` and
   * `req.protocol` reflect the client. `0` (default) in development, where nothing sits in front.
   */
  @IsInt()
  @Min(0)
  @Max(MAX_TRUST_PROXY_HOPS)
  TRUST_PROXY: number = 0;

  /**
   * `Secure` attribute and `__Host-` prefix of the session cookies (D34, `SessionCookies`). Fail-safe:
   * only the exact value `false` disables it, any other value (or none) keeps it on. Set it to
   * `false` only for local development over plain http.
   */
  @Transform(({ obj }: { obj: Record<string, unknown> }) => {
    const raw = obj['SESSION_COOKIE_SECURE'];
    return !(raw === false || raw === 'false');
  })
  @IsBoolean()
  SESSION_COOKIE_SECURE: boolean = true;

  /**
   * Opens the sign-up (`POST /api/auth/register`, D39). Closed beta: disabled by default, and
   * fail-safe: only the exact value `true` enables it. Must stay `false` in production until the
   * email lot (verification, reset, non-enumerating sign-up) is delivered.
   */
  @Transform(({ obj }: { obj: Record<string, unknown> }) => {
    const raw = obj['REGISTRATION_ENABLED'];
    return raw === true || raw === 'true';
  })
  @IsBoolean()
  REGISTRATION_ENABLED: boolean = false;
}

/** Thrown when the environment does not match its schema. Its message is safe to log. */
export class EnvironmentValidationError extends Error {
  constructor(errors: readonly ValidationError[]) {
    super(`Invalid environment variables:\n${errors.map(describeValidationError).join('\n')}`);
    this.name = EnvironmentValidationError.name;
  }
}

/**
 * Converts raw environment variables (strings) into a typed, validated instance of `schema`.
 *
 * @throws {EnvironmentValidationError} listing the invalid variable names and failed constraints.
 */
export function validateEnvironment<T extends object>(
  schema: ClassConstructor<T>,
  rawEnvironment: Record<string, unknown>,
): T {
  const environment = plainToInstance(schema, rawEnvironment, { enableImplicitConversion: true });
  const errors = validateSync(environment, {
    validationError: { target: false, value: false },
  });

  if (errors.length > 0) {
    throw new EnvironmentValidationError(errors);
  }
  return environment;
}

function splitCommaSeparatedList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// GDPR / secrets: only the variable name and the failed constraint names are reported, never the value.
function describeValidationError(error: ValidationError): string {
  const constraints = Object.keys(error.constraints ?? {}).join(', ');
  return `  - ${error.property}: ${constraints}`;
}
