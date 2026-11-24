import { addressGroup } from "@sharadox/protection-web-library/address-group";
import { limitRate } from "@sharadox/protection-web-library/rate-limit";
import { spendFromCap } from "@sharadox/protection-web-library/spending-cap";
import { signInLimits } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { requestCode } from "@sharadox/account-web-library/code-request";
import type { CodeSending, CodeSendingResult } from "@sharadox/account-web-library/code-sending/type";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";

/**
 * Sends a one-time code to a contact, each check cheaper than what it protects: rate limits per contact, per
 * address group (an IPv6 /64 is one visitor) and for everyone; then the channel's daily spending cap (past it,
 * sending pauses: it never spends); then a new code, sent by `deliver` after answering. Each send is recorded in the
 * audit log (`code.sent`, or `code.delivery-failed` with the error, never the code; a failure is thrown).
 *
 * @example
 * const result = await sendCode(server, { purpose: "step-up", contact, channel, accountId, address, language });
 * if (result.status === "sent") after(result.deliver);
 */
export async function sendCode(
  server: AccountServer,
  { purpose, contact, channel, accountId = null, address, language, now = Date.now() }: CodeSending,
): Promise<CodeSendingResult> {
  const limits = signInLimits(server);
  const rate = await limitRate(
    server.database,
    [
      { key: `contact:${contact.kind}:${contact.value}`, rule: limits.perContact },
      { key: `address:${addressGroup(address)}`, rule: limits.perAddress },
      { key: "global:sign-in", rule: limits.global },
    ],
    { secret: deriveSecret(server.secret, "rate-limit"), now },
  );
  if (!rate.allowed) return { status: "refused", reason: "rate-limit", retryAfterSeconds: rate.retryAfterSeconds };
  const cap = await spendFromCap(
    server.database,
    { name: `${contact.kind}-send`, limit: limits.dailySendsPerChannel, period: "day" },
    { now },
  );
  if (!cap.allowed) return { status: "refused", reason: "unavailable" };
  const request = await requestCode(server.database, {
    purpose,
    contact,
    ...(accountId ? { accountId } : {}),
    pepper: deriveSecret(server.secret, "one-time-code"),
    now,
  });
  const detail = { kind: request.contact.kind, purpose, requestId: request.requestId };
  return {
    status: "sent",
    requestId: request.requestId,
    deliver: async () => {
      try {
        await channel.send({
          contact: request.contact,
          code: request.code,
          purpose,
          language,
          expiresAt: request.expiresAt,
        });
      } catch (error) {
        // Nobody is waiting for the answer any more: the audit log is where a failed send shows (never the code).
        const { name, message } = error as Error;
        await recordAuditEvent(server.database, {
          accountId,
          action: "code.delivery-failed",
          detail: { ...detail, error: `${name}: ${message}`.slice(0, 500) },
        });
        throw error;
      }
      await recordAuditEvent(server.database, { accountId, action: "code.sent", detail });
    },
  };
}
