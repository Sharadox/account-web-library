import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type {
  CodeVerificationOptions,
  CodeVerificationResult,
} from "@sharadox/account-web-library/code-verification/type";
import { matchesOneTimeCode } from "@sharadox/account-web-library/one-time-code";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks a typed one-time code against its request, with the row locked so concurrent guesses can't pass the
 * attempt limit. The right code works once (the request then forgets the address), before it expires, unless a newer request replaced it or 5 wrong codes
 * came first. Returns the proved contact and the account that asked (null for sign-in).
 *
 * @example
 * const result = await verifyCode(database, { requestId, code: typed, purpose: "sign-in", pepper });
 * if (result.valid) signIn(await findAccountByContact(database, result.contact));
 */
export async function verifyCode(
  database: Kysely<AccountDatabase>,
  { requestId, code, purpose, pepper, maximumAttempts = 5, now = Date.now() }: CodeVerificationOptions,
): Promise<CodeVerificationResult> {
  if (!UUID.test(requestId)) return { valid: false, reason: "unknown" };
  return database.transaction().execute(async (transaction): Promise<CodeVerificationResult> => {
    const request = await transaction
      .selectFrom("code_request")
      .selectAll()
      .where("id", "=", requestId)
      .where("purpose", "=", purpose)
      .forUpdate()
      .executeTakeFirst();
    if (!request) return { valid: false, reason: "unknown" };
    if (request.used_at) return { valid: false, reason: "used" };
    if (request.voided_at) return { valid: false, reason: "replaced" };
    if (request.expires_at.getTime() <= now) return { valid: false, reason: "expired" };
    if (request.attempts >= maximumAttempts) return { valid: false, reason: "attempts" };
    const at = transaction.updateTable("code_request").where("id", "=", requestId);
    if (matchesOneTimeCode(code, request.code_hash, { pepper, purpose: `${purpose}:${requestId}` })) {
      // The address was only needed to send the code: a used request forgets it.
      await at.set({ used_at: new Date(now), value: "" }).execute();
      return { valid: true, contact: { kind: request.kind, value: request.value }, accountId: request.account_id };
    }
    const attempts = request.attempts + 1;
    await at.set({ attempts }).execute();
    return { valid: false, reason: attempts >= maximumAttempts ? "attempts" : "wrong" };
  });
}
