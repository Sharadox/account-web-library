import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import type { AuthenticationMethod } from "@sharadox/account-web-library/authentication-method/type";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

/**
 * Every way to sign in to an account: its verified emails that allow signing in, then its authenticator apps that
 * are on, oldest first. Any of them may be required: then every sign-in passes it. Without any required, one is
 * enough.
 *
 * @example
 * const methods = await authenticationMethods(database, { accountId });
 */
export async function authenticationMethods(
  database: Kysely<AccountDatabase>,
  { accountId }: { accountId: string },
): Promise<AuthenticationMethod[]> {
  const [contacts, authenticators] = await Promise.all([
    database
      .selectFrom("contact")
      .select(["id", "kind", "value", "required"])
      .where("account_id", "=", accountId)
      .where("verified_at", "is not", null)
      .where("sign_in", "=", true)
      .orderBy("id")
      .execute(),
    database
      .selectFrom("totp_credential")
      .select(["id", "name", "required"])
      .where("account_id", "=", accountId)
      .where("confirmed_at", "is not", null)
      .orderBy("id")
      .execute(),
  ]);
  return [
    ...contacts.map(({ id, value, required }) => ({ kind: "email" as const, id, value, required })),
    ...authenticators.map(({ id, name, required }) => ({ kind: "authenticator" as const, id, name, required })),
  ];
}

/**
 * Makes one of the account's methods required at every sign-in, or one way among others. Recorded in the audit log.
 * Ask for a fresh code first (step-up).
 *
 * @example
 * await setMethodRequired(database, { accountId, kind: "authenticator", id, required: true }); // { changed: true }
 */
export async function setMethodRequired(
  database: Kysely<AccountDatabase>,
  {
    accountId,
    kind,
    id,
    required,
    now = Date.now(),
  }: { accountId: string; kind: AuthenticationMethod["kind"]; id: string; required: boolean; now?: number },
): Promise<{ changed: boolean }> {
  return database.transaction().execute(async (transaction) => {
    const result =
      kind === "email"
        ? await transaction
            .updateTable("contact")
            .set({ required })
            .where("id", "=", id)
            .where("account_id", "=", accountId)
            .where("verified_at", "is not", null)
            .executeTakeFirst()
        : await transaction
            .updateTable("totp_credential")
            .set({ required })
            .where("id", "=", id)
            .where("account_id", "=", accountId)
            .where("confirmed_at", "is not", null)
            .executeTakeFirst();
    if (result.numUpdatedRows === 0n) return { changed: false };
    await recordAuditEvent(transaction, {
      accountId,
      action: required ? "method.required" : "method.optional",
      detail: { kind, id },
      now,
    });
    return { changed: true };
  });
}

/**
 * A contact shown to someone who hasn't signed in yet: enough to recognize it, not to learn it. An email keeps its
 * first character and its domain (`a•••@example.com`); anything else its last three characters.
 *
 * @example
 * contactHint({ kind: "email", value: "ana@example.com" }); // "a•••@example.com"
 */
export function contactHint({ kind, value }: Contact): string {
  if (kind === "email") {
    const at = value.lastIndexOf("@");
    return `${value[0]}•••${value.slice(at)}`;
  }
  return `•••${value.slice(-3)}`;
}
