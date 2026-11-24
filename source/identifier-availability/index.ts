import { sql, type Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { checkIdentifier } from "@sharadox/account-web-library/identifier";

/**
 * Whether an identifier can be taken: `available`, `taken` (in any case: `aBc` is taken when `abc` exists) or `invalid`
 * (outside the rules). Rate limit callers: it tells whether an account exists.
 *
 * @example
 * await identifierAvailability(database, "Luis-Pires"); // "available"
 */
export async function identifierAvailability(
  database: Kysely<AccountDatabase>,
  identifier: string,
): Promise<"available" | "taken" | "invalid"> {
  const check = checkIdentifier(identifier);
  if (!check.valid) return "invalid";
  const found = await database
    .selectFrom("identifier")
    .select("id")
    .where(sql<string>`lower(value)`, "=", check.key)
    .executeTakeFirst();
  return found ? "taken" : "available";
}
