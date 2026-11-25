import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { normalizeContact } from "@sharadox/account-web-library/contact-kind";
import { databaseError } from "@sharadox/account-web-library/database-error";
import type { PersonAccountRequest, PersonAccountResult } from "@sharadox/account-web-library/person-account/type";
import { checkAccountName } from "@sharadox/account-web-library/account-name";
import { checkIdentifier } from "@sharadox/account-web-library/identifier";

/**
 * Creates a person's account with the contact their one-time code just proved, as its verified sign-in contact, and
 * records it — all or nothing. Refuses a name outside the rules (`checkAccountName`, stored tidied), an identifier outside the rules or taken in any case, and a contact another
 * account has verified.
 *
 * @example
 * const result = await createPersonAccount(database, {
 *   name: "Luis Pires",
 *   identifier: "Luis-Pires",
 *   contact: { kind: "email", value },
 * });
 * if (!result.created) return explain(result.reason);
 */
export async function createPersonAccount(
  database: Kysely<AccountDatabase>,
  { name, identifier, contact, language, now = Date.now() }: PersonAccountRequest,
): Promise<PersonAccountResult> {
  const named = checkAccountName(name);
  if (!named.valid) return { created: false, reason: "name-invalid" };
  if (!checkIdentifier(identifier).valid) return { created: false, reason: "identifier-invalid" };
  const { kind, value } = normalizeContact(contact);
  const at = new Date(now);
  const accountId = uuidVersion7({ now });
  const contactId = uuidVersion7({ now });
  try {
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto("account")
        .values({
          id: accountId,
          kind: "person",
          name: named.name,
          owner_id: null,
          created_at: at,
          last_active_at: at,
          language: language?.slice(0, 20) ?? null,
        })
        .execute();
      await transaction
        .insertInto("identifier")
        .values({ id: uuidVersion7({ now }), value: identifier, account_id: accountId, created_at: at })
        .execute();
      await transaction
        .insertInto("contact")
        .values({ id: contactId, account_id: accountId, kind, value, verified_at: at, created_at: at })
        .execute();
      await recordAuditEvent(transaction, { accountId, action: "account.created", detail: { contactId }, now });
    });
  } catch (error) {
    const constraint = databaseError(error)?.constraint;
    if (constraint === "identifier_value_key") return { created: false, reason: "identifier-taken" };
    if (constraint === "contact_verified") return { created: false, reason: "contact-taken" };
    throw error;
  }
  return { created: true, accountId, contactId };
}
