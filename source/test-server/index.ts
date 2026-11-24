import { createMemoryDatabase } from "@sharadox/database-web-library/memory-database";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import { migrateProtection } from "@sharadox/protection-web-library/protection-migration";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import { migrateAccount } from "@sharadox/account-web-library/account-migration";

/**
 * A migrated account server database (account and protection tables) in memory, for tests of the sign-in flow.
 *
 * @example
 * const memory = await createTestServerDatabase();
 */
export async function createTestServerDatabase(): Promise<MemoryDatabase<AccountServerDatabase>> {
  const memory = await createMemoryDatabase<AccountServerDatabase>();
  await migrateProtection(memory.database);
  await migrateAccount(memory.database);
  return memory;
}
