import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountExport } from "@sharadox/account-web-library/account-export/type";

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

/**
 * Everything stored about an account, ready to download as JSON: the account, its identifier, contacts, picture,
 * two-factor status, devices and full history. Never secrets: no token, code or key hashes, no TOTP secret.
 * Undefined for an unknown account.
 *
 * @example
 * const data = await exportAccount(database, { accountId });
 * return Response.json(data, { headers: { "content-disposition": 'attachment; filename="account.json"' } });
 */
export async function exportAccount(
  database: Kysely<AccountDatabase>,
  { accountId, now = Date.now() }: { accountId: string; now?: number },
): Promise<AccountExport | undefined> {
  const account = await database
    .selectFrom("account")
    .innerJoin("identifier", "identifier.account_id", "account.id")
    .select([
      "account.id",
      "account.kind",
      "account.name",
      "identifier.value as identifier",
      "account.created_at",
      "account.last_active_at",
    ])
    .where("account.id", "=", accountId)
    .executeTakeFirst();
  if (!account) return undefined;
  const [contacts, picture, totp, recovery, sessions, activity] = await Promise.all([
    database.selectFrom("contact").selectAll().where("account_id", "=", accountId).orderBy("id").execute(),
    database.selectFrom("account_picture").selectAll().where("account_id", "=", accountId).executeTakeFirst(),
    database
      .selectFrom("totp_credential")
      .select("id")
      .where("account_id", "=", accountId)
      .where("confirmed_at", "is not", null)
      .executeTakeFirst(),
    database
      .selectFrom("recovery_code")
      .select("id")
      .where("account_id", "=", accountId)
      .where("used_at", "is", null)
      .execute(),
    database
      .selectFrom("account_session")
      .innerJoin("browser_session", "browser_session.id", "account_session.browser_session_id")
      .select(["browser_session.user_agent", "account_session.created_at", "account_session.last_seen_at"])
      .where("account_session.account_id", "=", accountId)
      .orderBy("account_session.id")
      .execute(),
    database
      .selectFrom("audit_event")
      .select(["id", "at", "action", "detail"])
      .where("account_id", "=", accountId)
      .orderBy("id", "desc")
      .execute(),
  ]);
  return {
    exportedAt: iso(new Date(now)),
    account: {
      id: account.id,
      kind: account.kind,
      name: account.name,
      identifier: account.identifier,
      createdAt: iso(account.created_at),
      lastActiveAt: iso(account.last_active_at),
    },
    contacts: contacts.map((contact) => ({
      id: contact.id,
      kind: contact.kind,
      value: contact.value,
      verifiedAt: isoOrNull(contact.verified_at),
      signIn: contact.sign_in,
      createdAt: iso(contact.created_at),
    })),
    picture: picture
      ? { id: picture.id, width: picture.width, height: picture.height, createdAt: iso(picture.created_at) }
      : null,
    secondFactor: { authenticatorApp: totp !== undefined, recoveryCodesLeft: recovery.length },
    sessions: sessions.map((session) => ({
      userAgent: session.user_agent,
      signedInAt: iso(session.created_at),
      lastSeenAt: iso(session.last_seen_at),
    })),
    activity: activity.map((event) => ({ ...event, at: iso(event.at) })),
  };
}
