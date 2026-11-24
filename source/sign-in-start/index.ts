import { redeemSolution } from "@sharadox/protection-web-library/solution-redemption";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { readBrowserSession } from "@sharadox/account-web-library/browser-session-read";
import { sendCode } from "@sharadox/account-web-library/code-sending";
import { findAccountByContact } from "@sharadox/account-web-library/contact-lookup";
import { normalizeContact } from "@sharadox/account-web-library/contact-kind";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import type { SignInStart, SignInStartResult } from "@sharadox/account-web-library/sign-in-start/type";

/**
 * The first step of signing in (and of signing up: they are the same): a code to the contact. In order, each check
 * cheaper than what it protects:
 * 1. a single-use proof of work;
 * 2. a valid contact with a channel;
 * 3. `sendCode`: rate limits, the channel's spending cap, then a new code sent by `deliver` after answering.
 * A browser already signed in to the account with that verified contact gets `signed-in` instead, and nothing is sent.
 * Otherwise the answer never depends on whether an account exists, so nobody can probe for accounts.
 *
 * @example
 * const result = await startSignIn(server, { contact, solution, address: clientAddress(request), language });
 * if (result.status === "sent") after(result.deliver);
 */
export async function startSignIn(
  server: AccountServer,
  { contact, solution, address, language, token, now = Date.now() }: SignInStart,
): Promise<SignInStartResult> {
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
  if (token) {
    const owner = await findAccountByContact(server.database, normalized);
    const browser = owner && (await readBrowserSession(server.database, { token, now }));
    if (owner && browser?.accounts.some(({ accountId }) => accountId === owner.accountId))
      return { status: "signed-in", accountId: owner.accountId };
  }
  return sendCode(server, { purpose: "sign-in", contact: normalized, channel, address, language, now });
}
