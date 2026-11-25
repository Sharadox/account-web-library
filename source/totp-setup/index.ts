import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountTables } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { encodeBase32 } from "@sharadox/account-web-library/base-32";
import { decryptSecret, encryptSecret } from "@sharadox/account-web-library/secret-encryption";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { createTotpSecret, totpUri, verifyTotp } from "@sharadox/account-web-library/totp";
import type {
  TotpRename,
  TotpSetupConfirmation,
  TotpSetupStart,
  TotpStatus,
} from "@sharadox/account-web-library/totp-setup/type";

/** An authenticator's name as kept: trimmed, 1 to 50 characters, or undefined when it can't be. */
function authenticatorName(name: string): string | undefined {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50 ? trimmed : undefined;
}

/**
 * Starts setting up an authenticator app, named by its owner ("Phone"): a new secret, stored encrypted and not yet
 * on, to show as a QR code (`uri`) or to type in (`secret`). An account can have any number of authenticators;
 * starting again replaces only an unfinished setup. Ask for a fresh code first (step-up).
 *
 * @example
 * const setup = await startTotpSetup(server, { accountId, issuer: "Luis Pires Decor", name: "Phone" });
 */
export async function startTotpSetup(
  server: AccountServer,
  { accountId, issuer, name, now = Date.now() }: { accountId: string; issuer: string; name: string; now?: number },
): Promise<TotpSetupStart> {
  const kept = authenticatorName(name);
  if (!kept) return { status: "name" };
  const account = await server.database
    .selectFrom("identifier")
    .select("value")
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  if (!account) return { status: "no-account" };
  const secret = createTotpSecret();
  const id = uuidVersion7({ now });
  await accountTables(server)
    .transaction()
    .execute(async (transaction) => {
      await transaction
        .deleteFrom("totp_credential")
        .where("account_id", "=", accountId)
        .where("confirmed_at", "is", null)
        .execute();
      await transaction
        .insertInto("totp_credential")
        .values({
          id,
          account_id: accountId,
          name: kept,
          secret_ciphertext: encryptSecret(secret, deriveSecret(server.secret, "totp-encryption")),
          created_at: new Date(now),
        })
        .execute();
    });
  return {
    status: "started",
    id,
    uri: totpUri({ issuer, account: account.value, secret }),
    secret: encodeBase32(secret),
  };
}

/**
 * Turns an authenticator on once it shows a right code. Recovery codes are then offered, never made on their own
 * (`regenerateRecoveryCodes`).
 *
 * @example
 * const result = await confirmTotpSetup(server, { accountId, id: setup.id, code });
 */
export async function confirmTotpSetup(
  server: AccountServer,
  { accountId, id, code, now = Date.now() }: { accountId: string; id: string; code: string; now?: number },
): Promise<TotpSetupConfirmation> {
  return accountTables(server)
    .transaction()
    .execute(async (transaction): Promise<TotpSetupConfirmation> => {
      const pending = await transaction
        .selectFrom("totp_credential")
        .select(["id", "name", "secret_ciphertext"])
        .where("id", "=", id)
        .where("account_id", "=", accountId)
        .where("confirmed_at", "is", null)
        .forUpdate()
        .executeTakeFirst();
      if (!pending) return { confirmed: false, reason: "none" };
      const secret = decryptSecret(pending.secret_ciphertext, deriveSecret(server.secret, "totp-encryption"));
      const verification = verifyTotp(secret, code.replace(/\s/g, ""), now);
      if (!verification.valid) return { confirmed: false, reason: "wrong" };
      await transaction
        .updateTable("totp_credential")
        .set({ confirmed_at: new Date(now), last_used_step: verification.step })
        .where("id", "=", pending.id)
        .execute();
      await recordAuditEvent(transaction, {
        accountId,
        action: "authenticator.added",
        detail: { authenticatorId: pending.id },
        now,
      });
      return { confirmed: true };
    });
}

/**
 * Renames one of the account's authenticators.
 *
 * @example
 * await renameTotp(database, { accountId, id, name: "Old phone" }); // { renamed: true }
 */
export async function renameTotp(
  database: Kysely<AccountDatabase>,
  { accountId, id, name }: { accountId: string; id: string; name: string },
): Promise<TotpRename> {
  const kept = authenticatorName(name);
  if (!kept) return { renamed: false, reason: "name" };
  const result = await database
    .updateTable("totp_credential")
    .set({ name: kept })
    .where("id", "=", id)
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  return result.numUpdatedRows === 0n ? { renamed: false, reason: "none" } : { renamed: true };
}

/**
 * Removes one authenticator; with the last one, the recovery codes go too (they stand in for an authenticator). Ask
 * for a fresh code first (step-up).
 *
 * @example
 * await removeTotp(database, { accountId, id }); // { removed: true }
 */
export async function removeTotp(
  database: Kysely<AccountDatabase>,
  { accountId, id, now = Date.now() }: { accountId: string; id: string; now?: number },
): Promise<{ removed: boolean }> {
  return database.transaction().execute(async (transaction) => {
    const removed = await transaction
      .deleteFrom("totp_credential")
      .where("id", "=", id)
      .where("account_id", "=", accountId)
      .where("confirmed_at", "is not", null)
      .executeTakeFirst();
    if (removed.numDeletedRows === 0n) return { removed: false };
    const left = await transaction
      .selectFrom("totp_credential")
      .select("id")
      .where("account_id", "=", accountId)
      .where("confirmed_at", "is not", null)
      .executeTakeFirst();
    if (!left) await transaction.deleteFrom("recovery_code").where("account_id", "=", accountId).execute();
    await recordAuditEvent(transaction, {
      accountId,
      action: "authenticator.removed",
      detail: { authenticatorId: id },
      now,
    });
    return { removed: true };
  });
}

/**
 * The account's authenticators that are on (oldest first), and how many recovery codes it has left.
 *
 * @example
 * const { authenticators, recoveryCodesLeft } = await totpStatus(database, { accountId });
 */
export async function totpStatus(
  database: Kysely<AccountDatabase>,
  { accountId }: { accountId: string },
): Promise<TotpStatus> {
  const [authenticators, codes] = await Promise.all([
    database
      .selectFrom("totp_credential")
      .select(["id", "name", "required", "created_at"])
      .where("account_id", "=", accountId)
      .where("confirmed_at", "is not", null)
      .orderBy("id")
      .execute(),
    database
      .selectFrom("recovery_code")
      .select("id")
      .where("account_id", "=", accountId)
      .where("used_at", "is", null)
      .execute(),
  ]);
  return {
    authenticators: authenticators.map(({ id, name, required, created_at }) => ({
      id,
      name,
      required,
      createdAt: created_at,
    })),
    recoveryCodesLeft: codes.length,
  };
}
