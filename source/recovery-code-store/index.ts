import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { hashOneTimeCode } from "@sharadox/account-web-library/one-time-code";
import { createRecoveryCodes, normalizeRecoveryCode } from "@sharadox/account-web-library/recovery-code";

/**
 * The stored form of a recovery code: an HMAC bound to its account, never the code.
 *
 * @example
 * const hash = recoveryCodeHash(typed, { accountId, pepper });
 */
export function recoveryCodeHash(code: string, { accountId, pepper }: { accountId: string; pepper: string }): string {
  return hashOneTimeCode(normalizeRecoveryCode(code), { pepper, purpose: `recovery:${accountId}` });
}

/**
 * Replaces an account's recovery codes with 10 new ones (inside the caller's transaction) and returns them, to show
 * once. Old codes stop working.
 *
 * @example
 * const codes = await replaceRecoveryCodes(transaction, { accountId, pepper });
 */
export async function replaceRecoveryCodes(
  database: Kysely<AccountDatabase>,
  { accountId, pepper, now = Date.now() }: { accountId: string; pepper: string; now?: number },
): Promise<string[]> {
  const codes = createRecoveryCodes();
  await database.deleteFrom("recovery_code").where("account_id", "=", accountId).execute();
  await database
    .insertInto("recovery_code")
    .values(
      codes.map((code) => ({
        id: uuidVersion7({ now }),
        account_id: accountId,
        code_hash: recoveryCodeHash(code, { accountId, pepper }),
        created_at: new Date(now),
      })),
    )
    .execute();
  return codes;
}
