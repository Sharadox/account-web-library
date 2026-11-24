import { expect, test } from "vitest";
import { verifySolution } from "@sharadox/protection-web-library/proof-of-work";
import { solveChallenge } from "@sharadox/protection-web-library/proof-of-work-solver";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { issueChallenge } from "@sharadox/account-web-library/challenge-issue";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";

const secret = "a-root-secret-of-at-least-thirty-two-characters";
const server = (limits = {}) => ({ database: undefined, channels: [], secret, limits }) as unknown as AccountServer;

test("issues a challenge at the configured difficulty (14 bits by default), signed with the derived key", async () => {
  const challenge = issueChallenge(server(), { now: 0 });
  expect(challenge.difficulty).toBe(14);
  expect(issueChallenge(server({ difficulty: 3 })).difficulty).toBe(3);
  const easy = issueChallenge(server({ difficulty: 2 }), { now: 0 });
  const nonce = await solveChallenge(easy);
  expect(
    verifySolution({ challenge: easy, nonce }, { secret: deriveSecret(secret, "proof-of-work"), now: 0 }).valid,
  ).toBe(true);
});
