import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";

/**
 * For tests: a person named after their identifier, with `<identifier>@example.com` verified. Returns the account
 * and contact ids.
 *
 * @example
 * const { accountId } = await createTestPerson(memory.database, "ana");
 */
export async function createTestPerson(
  database: Kysely<AccountDatabase>,
  identifier: string,
  now?: number,
): Promise<{ accountId: string; contactId: string }> {
  const result = await createPersonAccount(database, {
    name: identifier,
    identifier,
    contact: { kind: "email", value: `${identifier.toLowerCase()}@example.com` },
    ...(now === undefined ? {} : { now }),
  });
  if (!result.created) throw new Error(`test person "${identifier}" not created: ${result.reason}`);
  return { accountId: result.accountId, contactId: result.contactId };
}
