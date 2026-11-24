import { createMemoryDatabase } from "@sharadox/database-web-library/memory-database";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { migrateAccount } from "@sharadox/account-web-library/account-migration";

/**
 * A migrated account database in memory, for this library's tests (and applications' own): Postgres 18 through
 * PGlite, so every constraint and trigger runs as in production.
 *
 * @example
 * const memory = await createTestAccountDatabase();
 * // … test …
 * await memory.close();
 */
export async function createTestAccountDatabase(): Promise<MemoryDatabase<AccountDatabase>> {
  const memory = await createMemoryDatabase<AccountDatabase>();
  await migrateAccount(memory.database);
  return memory;
}
