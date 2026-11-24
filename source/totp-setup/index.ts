import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountTables } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { encodeBase32 } from "@sharadox/account-web-library/base-32";
import { replaceRecoveryCodes } from "@sharadox/account-web-library/recovery-code-store";
import { decryptSecret, encryptSecret } from "@sharadox/account-web-library/secret-encryption";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { createTotpSecret, totpUri, verifyTotp } from "@sharadox/account-web-library/totp";
import type { TotpSetupConfirmation, TotpSetupStart, TotpStatus } from "@sharadox/account-web-library/totp-setup/type";

/**
 * Starts setting up an authenticator app (two-factor): a new secret, stored encrypted and not yet on, to show as a
 * QR code (`uri`) or to type in (`secret`). Starting again replaces an unfinished setup. Ask for a fresh code first
 * (step-up).
 *
 * @example
 * const setup = await startTotpSetup(server, { accountId, issuer: "Luis Pires Decor" });
 */
export async function startTotpSetup(
  server: AccountServer,
  { accountId, issuer, now = Date.now() }: { accountId: string; issuer: string; now?: number },
): Promise<TotpSetupStart> {
  const account = await server.database
    .selectFrom("identifier")
    .select("value")
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  if (!account) return { status: "no-account" };
  const secret = createTotpSecret();
  return accountTables(server)
    .transaction()
    .execute(async (transaction): Promise<TotpSetupStart> => {
      const existing = await transaction
        .selectFrom("totp_credential")
        .select(["id", "confirmed_at"])
        .where("account_id", "=", accountId)
        .forUpdate()
        .executeTakeFirst();
      if (existing?.confirmed_at) return { status: "already-on" };
      if (existing) await transaction.deleteFrom("totp_credential").where("id", "=", existing.id).execute();
      await transaction
        .insertInto("totp_credential")
        .values({
          id: uuidVersion7({ now }),
          account_id: accountId,
          secret_ciphertext: encryptSecret(secret, deriveSecret(server.secret, "totp-encryption")),
          created_at: new Date(now),
        })
        .execute();
      return {
        status: "started",
        uri: totpUri({ issuer, account: account.value, secret }),
        secret: encodeBase32(secret),
      };
    });
}

/**
 * Turns two-factor on once the authenticator app shows a right code, and makes 10 recovery codes to show once.
 *
 * @example
 * const result = await confirmTotpSetup(server, { accountId, code });
 * if (result.confirmed) show(result.recoveryCodes);
 */
export async function confirmTotpSetup(
  server: AccountServer,
  { accountId, code, now = Date.now() }: { accountId: string; code: string; now?: number },
): Promise<TotpSetupConfirmation> {
  return accountTables(server)
    .transaction()
    .execute(async (transaction): Promise<TotpSetupConfirmation> => {
      const pending = await transaction
        .selectFrom("totp_credential")
        .select(["id", "secret_ciphertext"])
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
      const recoveryCodes = await replaceRecoveryCodes(transaction, {
        accountId,
        pepper: deriveSecret(server.secret, "recovery-code"),
        now,
      });
      await recordAuditEvent(transaction, { accountId, action: "second-factor.turned-on", now });
      return { confirmed: true, recoveryCodes };
    });
}

/**
 * Turns two-factor off: the authenticator app and the recovery codes. Ask for a fresh code first (step-up).
 *
 * @example
 * await removeTotp(database, { accountId }); // { removed: true }
 */
export async function removeTotp(
  database: Kysely<AccountDatabase>,
  { accountId }: { accountId: string },
): Promise<{ removed: boolean }> {
  return database.transaction().execute(async (transaction) => {
    const removed = await transaction
      .deleteFrom("totp_credential")
      .where("account_id", "=", accountId)
      .where("confirmed_at", "is not", null)
      .executeTakeFirst();
    if (removed.numDeletedRows === 0n) return { removed: false };
    await transaction.deleteFrom("recovery_code").where("account_id", "=", accountId).execute();
    await recordAuditEvent(transaction, { accountId, action: "second-factor.turned-off" });
    return { removed: true };
  });
}

/**
 * Whether an account has two-factor on, and how many recovery codes it has left.
 *
 * @example
 * const { on, recoveryCodesLeft } = await totpStatus(database, { accountId });
 */
export async function totpStatus(
  database: Kysely<AccountDatabase>,
  { accountId }: { accountId: string },
): Promise<TotpStatus> {
  const [credential, codes] = await Promise.all([
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
  ]);
  return { on: credential !== undefined, recoveryCodesLeft: codes.length };
}
