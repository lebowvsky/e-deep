import { Transform, plainToInstance, type ClassConstructor } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
  type ValidationError,
} from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'production', 'test'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

const MIN_PORT = 1;
const MAX_PORT = 65_535;

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
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV: NodeEnvironment = 'development';

  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  PORT: number = 3000;

  /** Comma-separated list in the environment, e.g. `http://localhost:5173,http://localhost:5174`. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? splitCommaSeparatedList(value) : value,
  )
  @ArrayNotEmpty()
  @IsUrl(
    { require_tld: false, require_protocol: true, protocols: ['http', 'https'] },
    { each: true },
  )
  CORS_ORIGINS: string[];
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
