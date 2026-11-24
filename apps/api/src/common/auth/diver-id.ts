declare const diverIdBrand: unique symbol;

/**
 * Id of the diver the request acts for, as resolved by the `SessionGuard` (D37). Branded: a plain
 * `string` (a route parameter, a body field) is not a `DiverId`, so it cannot be handed to a
 * service of the dive log by mistake. Read it with `@CurrentDiverId()`.
 */
export type DiverId = string & { readonly [diverIdBrand]: true };

/**
 * Brands an id as the current diver's. Production code never calls it: only `auth-context.ts`
 * mints a `DiverId`, from a resolved session. The ESLint `no-restricted-imports` rule forbids this
 * import anywhere else but the tests, the seed and the operator commands (`src/cli`).
 */
export function asDiverId(id: string): DiverId {
  // The single cast of the brand: a type-level marker, nothing is checked at runtime.
  return id as DiverId;
}
