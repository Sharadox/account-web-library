import { createChallenge } from "@sharadox/protection-web-library/proof-of-work";
import type { Challenge } from "@sharadox/protection-web-library/proof-of-work/type";
import { signInLimits } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";

/**
 * A proof-of-work challenge for the sign-in form, at the server's difficulty: the browser solves it in the
 * background (protection-web-library's `solveChallenge`) and sends the solution with the contact.
 *
 * @example
 * const challenge = issueChallenge(server); // give it to the page
 */
export function issueChallenge(server: AccountServer, { now = Date.now() }: { now?: number } = {}): Challenge {
  return createChallenge({
    secret: deriveSecret(server.secret, "proof-of-work"),
    difficulty: signInLimits(server).difficulty,
    now,
  });
}
