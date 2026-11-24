import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { normalizeContact } from "@sharadox/account-web-library/contact-kind";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

/**
 * The account a verified contact belongs to (written any way: it is normalized first), or undefined. Unverified
 * contacts never count, so claiming someone's address proves nothing.
 *
 * @example
 * const found = await findAccountByContact(database, { kind: "email", value: typed });
 */
export async function findAccountByContact(
  database: Kysely<AccountDatabase>,
  contact: Contact,
): Promise<{ accountId: string; contactId: string; signIn: boolean } | undefined> {
  const { kind, value } = normalizeContact(contact);
  const row = await database
    .selectFrom("contact")
    .select(["id", "account_id", "sign_in"])
    .where("kind", "=", kind)
    .where("value", "=", value)
    .where("verified_at", "is not", null)
    .executeTakeFirst();
  return row && { accountId: row.account_id, contactId: row.id, signIn: row.sign_in };
}
