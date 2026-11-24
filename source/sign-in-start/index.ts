import { addressGroup } from "@sharadox/protection-web-library/address-group";
import { limitRate } from "@sharadox/protection-web-library/rate-limit";
import { redeemSolution } from "@sharadox/protection-web-library/solution-redemption";
import { spendFromCap } from "@sharadox/protection-web-library/spending-cap";
import { signInLimits } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { requestCode } from "@sharadox/account-web-library/code-request";
import { normalizeContact } from "@sharadox/account-web-library/contact-kind";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import type { SignInStart, SignInStartResult } from "@sharadox/account-web-library/sign-in-start/type";

/**
 * The first step of signing in (and of signing up: they are the same): a code to the contact. In order, each check
 * cheaper than what it protects:
 * 1. a single-use proof of work;
 * 2. a valid contact with a channel;
 * 3. rate limits per contact, per address group (an IPv6 /64 is one visitor) and for everyone;
 * 4. the channel's daily spending cap (past it, sending pauses: it never spends);
 * 5. a new code, sent by `deliver` after answering.
 * The answer never depends on whether an account exists, so nobody can probe for accounts.
 *
 * @example
 * const result = await startSignIn(server, { contact, solution, address: clientAddress(request), language });
 * if (result.status === "sent") after(result.deliver);
 */
export async function startSignIn(
  server: AccountServer,
  { contact, solution, address, language, now = Date.now() }: SignInStart,
): Promise<SignInStartResult> {
  const limits = signInLimits(server);
  const proof = await redeemSolution(server.database, solution, {
    secret: deriveSecret(server.secret, "proof-of-work"),
    now,
  });
  if (!proof.valid) return { status: "refused", reason: "proof" };
  let normalized: Contact;
  try {
    normalized = normalizeContact(contact);
  } catch {
    return { status: "refused", reason: "contact" };
  }
  const channel = server.channels.find(({ kind }) => kind === normalized.kind);
  if (!channel) return { status: "refused", reason: "contact" };
  const rate = await limitRate(
    server.database,
    [
      { key: `contact:${normalized.kind}:${normalized.value}`, rule: limits.perContact },
      { key: `address:${addressGroup(address)}`, rule: limits.perAddress },
      { key: "global:sign-in", rule: limits.global },
    ],
    { secret: deriveSecret(server.secret, "rate-limit"), now },
  );
  if (!rate.allowed) return { status: "refused", reason: "rate-limit", retryAfterSeconds: rate.retryAfterSeconds };
  const cap = await spendFromCap(
    server.database,
    { name: `${normalized.kind}-send`, limit: limits.dailySendsPerChannel, period: "day" },
    { now },
  );
  if (!cap.allowed) return { status: "refused", reason: "unavailable" };
  const request = await requestCode(server.database, {
    purpose: "sign-in",
    contact: normalized,
    pepper: deriveSecret(server.secret, "one-time-code"),
    now,
  });
  return {
    status: "sent",
    requestId: request.requestId,
    deliver: () =>
      channel.send({
        contact: request.contact,
        code: request.code,
        purpose: "sign-in",
        language,
        expiresAt: request.expiresAt,
      }),
  };
}
