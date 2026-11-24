import { sql, type Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { checkUsername } from "@sharadox/account-web-library/username";

/**
 * Whether a username can be taken: `available`, `taken` (in any case: `aBc` is taken when `abc` exists) or `invalid`
 * (outside the rules). Rate limit callers: it tells whether an account exists.
 *
 * @example
 * await usernameAvailability(database, "Luis-Pires"); // "available"
 */
export async function usernameAvailability(
  database: Kysely<AccountDatabase>,
  username: string,
): Promise<"available" | "taken" | "invalid"> {
  const check = checkUsername(username);
  if (!check.valid) return "invalid";
  const found = await database
    .selectFrom("account")
    .select("id")
    .where(sql<string>`lower(username)`, "=", check.key)
    .executeTakeFirst();
  return found ? "taken" : "available";
}
