import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { CodePurpose, CodeRequest, CodeRequestOptions } from "@sharadox/account-web-library/code-request/type";
import { normalizeContact } from "@sharadox/account-web-library/contact-kind";
import { createOneTimeCode, hashOneTimeCode } from "@sharadox/account-web-library/one-time-code";

/** The purposes a code can have. */
export const CODE_PURPOSES: readonly CodePurpose[] = ["sign-in", "contact-verification", "step-up"];

/**
 * Starts a one-time code for a contact: a new code (8 digits, 10 minutes by default), stored only as an HMAC bound
 * to its purpose and request, replacing any open request for the same contact and purpose. Returns the code to send
 * through the contact's channel. Rate limit and cap the sends before calling it (protection-web-library).
 *
 * @example
 * const { requestId, code } = await requestCode(database, { purpose: "sign-in", contact, pepper });
 * await channel.send(contact, code); // after answering the request, so timing reveals nothing
 */
export async function requestCode(
  database: Kysely<AccountDatabase>,
  { purpose, contact, accountId, pepper, length = 6, lifetimeSeconds = 600, now = Date.now() }: CodeRequestOptions,
): Promise<CodeRequest> {
  if (!CODE_PURPOSES.includes(purpose)) throw new Error(`unknown code purpose "${purpose}"`);
  const { kind, value } = normalizeContact(contact);
  const requestId = uuidVersion7({ now });
  const code = createOneTimeCode(length);
  const codeHash = hashOneTimeCode(code, { pepper, purpose: `${purpose}:${requestId}` });
  const createdAt = new Date(now);
  const expiresAt = new Date(now + lifetimeSeconds * 1000);
  await database.transaction().execute(async (transaction) => {
    await transaction
      .updateTable("code_request")
      .set({ voided_at: createdAt })
      .where("kind", "=", kind)
      .where("value", "=", value)
      .where("purpose", "=", purpose)
      .where("used_at", "is", null)
      .where("voided_at", "is", null)
      .execute();
    await transaction
      .insertInto("code_request")
      .values({
        id: requestId,
        purpose,
        account_id: accountId ?? null,
        kind,
        value,
        code_hash: codeHash,
        created_at: createdAt,
        expires_at: expiresAt,
        used_at: null,
        voided_at: null,
      })
      .execute();
  });
  return { requestId, code, contact: { kind, value }, expiresAt };
}
