import { addressGroup } from "@sharadox/protection-web-library/address-group";
import { limitRate } from "@sharadox/protection-web-library/rate-limit";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { signInLimits } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { verifyCode } from "@sharadox/account-web-library/code-verification";
import { findAccountByContact } from "@sharadox/account-web-library/contact-lookup";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { createTicket } from "@sharadox/account-web-library/signed-ticket";
import type { SignInFinish, SignInFinishResult } from "@sharadox/account-web-library/sign-in-finish/type";

/** How long a sign-up ticket lasts: time to choose an identifier. */
const SIGN_UP_SECONDS = 900;
/** How long the two-factor step may take once the emailed code passed. */
const SECOND_FACTOR_SECONDS = 600;

/**
 * The second step: the typed code. Guesses are limited per address group (and per request by `verifyCode`). With the
 * right code, an account with that contact is signed in (or, with two-factor on, gets a ticket for that step) on the browser (the new token goes in its cookie); a contact
 * with no account gets a sign-up ticket for choosing an identifier.
 *
 * @example
 * const result = await finishSignIn(server, { requestId, code, address, token: cookie });
 */
export async function finishSignIn(
  server: AccountServer,
  { requestId, code, address, token, userAgent = null, now = Date.now() }: SignInFinish,
): Promise<SignInFinishResult> {
  const rate = await limitRate(
    server.database,
    [{ key: `verification:${addressGroup(address)}`, rule: signInLimits(server).verificationsPerAddress }],
    { secret: deriveSecret(server.secret, "rate-limit"), now },
  );
  if (!rate.allowed) return { status: "refused", reason: "rate-limit", retryAfterSeconds: rate.retryAfterSeconds };
  const verification = await verifyCode(server.database, {
    requestId,
    code,
    purpose: "sign-in",
    pepper: deriveSecret(server.secret, "one-time-code"),
    now,
  });
  if (!verification.valid) return { status: "refused", reason: verification.reason };
  const found = await findAccountByContact(server.database, verification.contact);
  if (!found) {
    const ticket = createTicket(
      { contact: verification.contact },
      {
        secret: deriveSecret(server.secret, "sign-up-ticket"),
        purpose: "sign-up",
        lifetimeSeconds: SIGN_UP_SECONDS,
        now,
      },
    );
    return { status: "sign-up", ticket };
  }
  if (!found.signIn) return { status: "refused", reason: "unknown" };
  const secondFactor = await server.database
    .selectFrom("totp_credential")
    .select("id")
    .where("account_id", "=", found.accountId)
    .where("confirmed_at", "is not", null)
    .executeTakeFirst();
  if (secondFactor) {
    const ticket = createTicket(
      { accountId: found.accountId },
      {
        secret: deriveSecret(server.secret, "second-factor-ticket"),
        purpose: "second-factor",
        lifetimeSeconds: SECOND_FACTOR_SECONDS,
        now,
      },
    );
    return { status: "second-factor", ticket };
  }
  const session = await signIn(server.database, { accountId: found.accountId, token, userAgent, now });
  return { status: "signed-in", accountId: found.accountId, token: session.token };
}
