import { accountTables } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { recoveryCodeHash } from "@sharadox/account-web-library/recovery-code-store";
import { decryptSecret } from "@sharadox/account-web-library/secret-encryption";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { verifyTotp } from "@sharadox/account-web-library/totp";

/**
 * Checks a code from one of the account's authenticator apps, and remembers its time step so the same code never
 * works twice. False for a wrong code, a used one, or an authenticator that isn't the account's or isn't on.
 *
 * @example
 * if (await verifyAuthenticatorCode(server, { accountId, id, code: "123 456" })) …
 */
export async function verifyAuthenticatorCode(
  server: AccountServer,
  { accountId, id, code, now = Date.now() }: { accountId: string; id: string; code: string; now?: number },
): Promise<boolean> {
  return accountTables(server)
    .transaction()
    .execute(async (transaction) => {
      const credential = await transaction
        .selectFrom("totp_credential")
        .select(["secret_ciphertext", "last_used_step"])
        .where("id", "=", id)
        .where("account_id", "=", accountId)
        .where("confirmed_at", "is not", null)
        .forUpdate()
        .executeTakeFirst();
      if (!credential) return false;
      const secret = decryptSecret(credential.secret_ciphertext, deriveSecret(server.secret, "totp-encryption"));
      const verification = verifyTotp(secret, code.replace(/\s/g, ""), now, {
        lastUsedStep: Number(credential.last_used_step),
      });
      if (!verification.valid) return false;
      await transaction
        .updateTable("totp_credential")
        .set({ last_used_step: verification.step })
        .where("id", "=", id)
        .execute();
      return true;
    });
}

/**
 * Uses one of the account's recovery codes (typed in any case, with or without its dashes): it works once, and the
 * use is in the audit log. Tell every contact afterwards (`recovery-code-used`).
 *
 * @example
 * if (await useRecoveryCode(server, { accountId, code: "abcd-efgh-…" })) notices.push({ kind: "recovery-code-used" });
 */
export async function useRecoveryCode(
  server: AccountServer,
  { accountId, code, now = Date.now() }: { accountId: string; code: string; now?: number },
): Promise<boolean> {
  const used = await server.database
    .updateTable("recovery_code")
    .set({ used_at: new Date(now) })
    .where("account_id", "=", accountId)
    .where(
      "code_hash",
      "=",
      recoveryCodeHash(code, { accountId, pepper: deriveSecret(server.secret, "recovery-code") }),
    )
    .where("used_at", "is", null)
    .executeTakeFirst();
  if (used.numUpdatedRows === 0n) return false;
  await recordAuditEvent(server.database, { accountId, action: "second-factor.recovery-code-used", now });
  return true;
}

/**
 * Whether the account has a recovery code left to use.
 *
 * @example
 * const offered = await hasRecoveryCode(server, accountId);
 */
export async function hasRecoveryCode(server: AccountServer, accountId: string): Promise<boolean> {
  const code = await server.database
    .selectFrom("recovery_code")
    .select("id")
    .where("account_id", "=", accountId)
    .where("used_at", "is", null)
    .executeTakeFirst();
  return code !== undefined;
}
