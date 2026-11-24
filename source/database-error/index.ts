/**
 * Postgres's error code (`23505` unique, `23514` check…) and the constraint that failed, from an error thrown by the
 * driver (Neon's or PGlite's); undefined for any other error.
 *
 * @example
 * if (databaseError(error)?.constraint === "account_username_key") return { reason: "username-taken" };
 */
export function databaseError(error: unknown): { code: string; constraint: string | undefined } | undefined {
  if (typeof error !== "object" || error === null || typeof (error as { code?: unknown }).code !== "string")
    return undefined;
  const { code, constraint } = error as { code: string; constraint?: string };
  return { code, constraint };
}
