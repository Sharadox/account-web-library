import { accountTables } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { replaceRecoveryCodes } from "@sharadox/account-web-library/recovery-code-store";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";

/**
 * Makes 10 recovery codes when the owner asks (never on their own), voiding any old ones, for an account with an
 * authenticator on. Show them once. Ask for a
 * fresh code first (step-up).
 *
 * @example
 * const result = await regenerateRecoveryCodes(server, { accountId });
 * if (result.status === "made") show(result.recoveryCodes);
 */
export async function regenerateRecoveryCodes(
  server: AccountServer,
  { accountId, now = Date.now() }: { accountId: string; now?: number },
): Promise<{ status: "made"; recoveryCodes: string[] } | { status: "second-factor-off" }> {
  return accountTables(server)
    .transaction()
    .execute(async (transaction) => {
      const on = await transaction
        .selectFrom("totp_credential")
        .select("id")
        .where("account_id", "=", accountId)
        .where("confirmed_at", "is not", null)
        .executeTakeFirst();
      if (!on) return { status: "second-factor-off" as const };
      const recoveryCodes = await replaceRecoveryCodes(transaction, {
        accountId,
        pepper: deriveSecret(server.secret, "recovery-code"),
        now,
      });
      await recordAuditEvent(transaction, { accountId, action: "second-factor.recovery-codes-made", now });
      return { status: "made" as const, recoveryCodes };
    });
}
