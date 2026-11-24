import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";

/**
 * Deletes code requests that expired before `before`, with the contacts they hold, from a daily job. Returns how
 * many were deleted.
 *
 * @example
 * await pruneCodeRequests(database, { before: new Date(Date.now() - 86_400_000) });
 */
export async function pruneCodeRequests(
  database: Kysely<AccountDatabase>,
  { before }: { before: Date },
): Promise<number> {
  const result = await database.deleteFrom("code_request").where("expires_at", "<", before).executeTakeFirst();
  return Number(result.numDeletedRows);
}
