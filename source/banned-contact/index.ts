import { createHmac } from "node:crypto";
import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { normalizeContact } from "@sharadox/account-web-library/contact-kind";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";
import { emailLedgerForm } from "@sharadox/account-web-library/email-contact";

/**
 * The form a contact is kept in the banned-contact ledger: an HMAC under a pepper kept outside the database, of the
 * contact normalized and, for an email, without its `+tag` (so `ana+new@` is still `ana@`). Never the contact.
 *
 * @example
 * bannedContactHash({ kind: "email", value: "Ana+x@example.com" }, pepper);
 */
export function bannedContactHash(contact: Contact, pepper: string): string {
  const { kind, value } = normalizeContact(contact);
  // Email is the only kind of contact so far (normalizeContact refuses others); a new kind brings its own form.
  const form = emailLedgerForm(value);
  return createHmac("sha256", pepper).update(`${kind}\n${form}`).digest("base64url");
}

/**
 * Whether a contact belongs to a deleted account banned in this application (or everywhere), while the ban lasts:
 * checked before signing up and adding a contact. An invalid contact is not banned.
 *
 * @example
 * if (await contactBanned(database, { contact, pepper, application: "account" })) return refuse();
 */
export async function contactBanned(
  database: Kysely<AccountDatabase>,
  {
    contact,
    pepper,
    application,
    now = Date.now(),
  }: { contact: Contact; pepper: string; application: string; now?: number },
): Promise<boolean> {
  let hash: string;
  try {
    hash = bannedContactHash(contact, pepper);
  } catch {
    return false;
  }
  const found = await database
    .selectFrom("banned_contact")
    .leftJoin("application", "application.id", "banned_contact.application_id")
    .select("banned_contact.id")
    .where("contact_hash", "=", hash)
    .where((where) =>
      where.or([where("banned_contact.application_id", "is", null), where("application.key", "=", application)]),
    )
    .where((where) => where.or([where("ends_at", "is", null), where("ends_at", ">", new Date(now))]))
    .executeTakeFirst();
  return found !== undefined;
}

/**
 * Forgets ledger rows whose ban has ended, for a daily job. Returns how many went.
 *
 * @example
 * await pruneBannedContacts(database);
 */
export async function pruneBannedContacts(
  database: Kysely<AccountDatabase>,
  { now = Date.now() }: { now?: number } = {},
): Promise<number> {
  const result = await database.deleteFrom("banned_contact").where("ends_at", "<=", new Date(now)).executeTakeFirst();
  return Number(result.numDeletedRows);
}
