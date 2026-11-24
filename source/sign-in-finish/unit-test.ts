import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import { solveChallenge } from "@sharadox/protection-web-library/proof-of-work-solver";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { readBrowserSession } from "@sharadox/account-web-library/browser-session-read";
import { issueChallenge } from "@sharadox/account-web-library/challenge-issue";
import type { CodeDelivery } from "@sharadox/account-web-library/contact-channel/type";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { finishSignIn } from "@sharadox/account-web-library/sign-in-finish";
import { startSignIn } from "@sharadox/account-web-library/sign-in-start";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

const secret = "a-root-secret-of-at-least-thirty-two-characters";
let memory: MemoryDatabase<AccountServerDatabase>;
let delivered: CodeDelivery[];
let server: AccountServer;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  delivered = [];
  server = {
    database: memory.database,
    channels: [{ kind: "email", send: async (delivery) => void delivered.push(delivery) }],
    secret,
    limits: { difficulty: 2 },
  };
});
afterEach(() => memory.close());

const codeFor = async (value: string, now = 0) => {
  const challenge = issueChallenge(server, { now });
  const result = await startSignIn(server, {
    contact: { kind: "email", value },
    solution: { challenge, nonce: await solveChallenge(challenge) },
    address: "203.0.113.7",
    language: "en",
    now,
  });
  if (result.status !== "sent") throw new Error(result.status);
  await result.deliver();
  return { requestId: result.requestId, code: delivered.at(-1)!.code };
};

test("signs an existing account in with the right code, joining the browser's other accounts", async () => {
  const created = await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "ana",
    contact: { kind: "email", value: "ana@example.com" },
  });
  if (!created.created) throw new Error("not created");
  const { requestId, code } = await codeFor("ana@example.com");
  const result = await finishSignIn(server, { requestId, code, address: "203.0.113.7", token: undefined, now: 1_000 });
  if (result.status !== "signed-in") throw new Error(result.status);
  expect(result.accountId).toBe(created.accountId);
  const session = await readBrowserSession(memory.database, { token: result.token, now: 2_000 });
  expect(session!.accounts.map(({ identifier }) => identifier)).toEqual(["ana"]);
});

test("for a contact with no account, gives a sign-up ticket instead", async () => {
  const { requestId, code } = await codeFor("new@example.com");
  const result = await finishSignIn(server, { requestId, code, address: "203.0.113.7", token: undefined, now: 1_000 });
  expect(result).toEqual({ status: "sign-up", ticket: expect.stringMatching(/^[\w-]+\.[\w-]+$/) });
});

test("refuses wrong codes with the reason, and limits guesses per address group", async () => {
  const { requestId, code } = await codeFor("ana@example.com");
  const wrong = code === "00000000" ? "11111111" : "00000000";
  expect(
    await finishSignIn(server, { requestId, code: wrong, address: "203.0.113.7", token: undefined, now: 1_000 }),
  ).toEqual({
    status: "refused",
    reason: "wrong",
  });
  server.limits = { difficulty: 2, verificationsPerAddress: { capacity: 1, refillPerSecond: 1 / 30 } };
  await finishSignIn(server, { requestId, code: wrong, address: "198.51.100.9", token: undefined, now: 1_000 });
  expect(
    await finishSignIn(server, { requestId, code, address: "198.51.100.9", token: undefined, now: 1_000 }),
  ).toEqual({
    status: "refused",
    reason: "rate-limit",
    retryAfterSeconds: 30,
  });
});

test("a contact that can't be used for signing in is refused like an unknown code", async () => {
  const created = await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "ana",
    contact: { kind: "email", value: "ana@example.com" },
  });
  if (!created.created) throw new Error("not created");
  await memory.database
    .insertInto("contact")
    .values({
      id: "0198f5a2-7a4c-7000-8000-000000000001",
      account_id: created.accountId,
      kind: "email",
      value: "second@example.com",
      verified_at: new Date(),
      sign_in: false,
    })
    .execute();
  const { requestId, code } = await codeFor("second@example.com");
  expect(await finishSignIn(server, { requestId, code, address: "203.0.113.7", token: undefined, now: 1_000 })).toEqual(
    {
      status: "refused",
      reason: "unknown",
    },
  );
});

test("uses the current time by default", async () => {
  const { requestId, code } = await codeFor("new@example.com", Date.now());
  expect((await finishSignIn(server, { requestId, code, address: "203.0.113.7", token: undefined })).status).toBe(
    "sign-up",
  );
});
