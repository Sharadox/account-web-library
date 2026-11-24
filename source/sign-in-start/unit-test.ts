import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import { solveChallenge } from "@sharadox/protection-web-library/proof-of-work-solver";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { issueChallenge } from "@sharadox/account-web-library/challenge-issue";
import type { CodeDelivery } from "@sharadox/account-web-library/contact-channel/type";
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

const solved = async (now = 0) => {
  const challenge = issueChallenge(server, { now });
  return { challenge, nonce: await solveChallenge(challenge) };
};
const start = async (value = "ana@example.com", address = "203.0.113.7", now = 0) =>
  startSignIn(server, {
    contact: { kind: "email", value },
    solution: await solved(now),
    address,
    language: "pt-PT",
    now,
  });

test("sends a code to the contact after answering, the same way whether or not an account exists", async () => {
  const result = await start(" Ana@Example.com ");
  if (result.status !== "sent") throw new Error(result.status);
  expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(delivered).toEqual([]);
  await result.deliver();
  const sent = await memory.database
    .selectFrom("audit_event")
    .select(["action", "detail"])
    .where("action", "=", "code.sent")
    .execute();
  expect(sent).toEqual([
    { action: "code.sent", detail: { kind: "email", purpose: "sign-in", requestId: result.requestId } },
  ]);
  expect(delivered).toEqual([
    {
      contact: { kind: "email", value: "ana@example.com" },
      code: expect.stringMatching(/^\d{6}$/),
      purpose: "sign-in",
      language: "pt-PT",
      expiresAt: new Date(600_000),
    },
  ]);
});

test("refuses a missing, replayed or wrong proof of work", async () => {
  const solution = await solved();
  const first = await startSignIn(server, {
    contact: { kind: "email", value: "a@example.com" },
    solution,
    address: "203.0.113.7",
    language: "en",
    now: 0,
  });
  expect(first.status).toBe("sent");
  expect(
    await startSignIn(server, {
      contact: { kind: "email", value: "a@example.com" },
      solution,
      address: "203.0.113.7",
      language: "en",
      now: 0,
    }),
  ).toEqual({
    status: "refused",
    reason: "proof",
  });
  const forged = { ...solution, challenge: { ...solution.challenge, difficulty: 0 } };
  expect(
    (
      await startSignIn(server, {
        contact: { kind: "email", value: "a@example.com" },
        solution: forged,
        address: "x",
        language: "en",
        now: 0,
      })
    ).status,
  ).toBe("refused");
});

test("refuses contacts that aren't valid or have no channel", async () => {
  expect(await start("not an address")).toEqual({ status: "refused", reason: "contact" });
  expect(
    await startSignIn(server, {
      contact: { kind: "pigeon", value: "x" },
      solution: await solved(),
      address: "203.0.113.7",
      language: "en",
      now: 0,
    }),
  ).toEqual({ status: "refused", reason: "contact" });
  server.channels = [];
  expect(await start()).toEqual({ status: "refused", reason: "contact" });
});

test("limits codes per contact, then per address group, and says how long to wait", async () => {
  for (let i = 0; i < 3; i++) expect((await start("ana@example.com", "203.0.113.7")).status).toBe("sent");
  expect(await start("ana@example.com", "198.51.100.1")).toEqual({
    status: "refused",
    reason: "rate-limit",
    retryAfterSeconds: 300,
  });
  for (let i = 0; i < 7; i++) expect((await start(`p${i}@example.com`, "2001:db8:1:2::1")).status).toBe("sent");
  // The same /64, another address: still the same visitor.
  for (let i = 7; i < 10; i++) expect((await start(`p${i}@example.com`, "2001:db8:1:2::ff")).status).toBe("sent");
  expect(await start("p10@example.com", "2001:db8:1:2::abcd")).toMatchObject({
    status: "refused",
    reason: "rate-limit",
  });
});

test("pauses sending when a channel's daily cap is reached, and never sends past it", async () => {
  server.limits = { difficulty: 2, dailySendsPerChannel: 2, perAddress: { capacity: 100, refillPerSecond: 1 } };
  expect((await start("a@example.com")).status).toBe("sent");
  expect((await start("b@example.com")).status).toBe("sent");
  expect(await start("c@example.com")).toEqual({ status: "refused", reason: "unavailable" });
});

test("a global limit caps everyone together", async () => {
  server.limits = { difficulty: 2, global: { capacity: 2, refillPerSecond: 1 / 60 } };
  expect((await start("a@example.com", "192.0.2.1")).status).toBe("sent");
  expect((await start("b@example.com", "192.0.2.2")).status).toBe("sent");
  expect(await start("c@example.com", "192.0.2.3")).toMatchObject({ status: "refused", reason: "rate-limit" });
});

test("uses the current time by default", async () => {
  const challenge = issueChallenge(server);
  const result = await startSignIn(server, {
    contact: { kind: "email", value: "a@example.com" },
    solution: { challenge, nonce: await solveChallenge(challenge) },
    address: "203.0.113.7",
    language: "en",
  });
  expect(result.status).toBe("sent");
});

test("a delivery that fails is recorded (the error, never the code) and passed on", async () => {
  server.channels = [
    {
      kind: "email",
      send: async () => {
        throw Object.assign(new Error("Access denied to the sending role"), { name: "AccessDenied" });
      },
    },
  ];
  const result = await start("ana@example.com");
  if (result.status !== "sent") throw new Error(result.status);
  await expect(result.deliver()).rejects.toThrow("Access denied to the sending role");
  const events = await memory.database
    .selectFrom("audit_event")
    .select(["action", "detail"])
    .where("action", "=", "code.delivery-failed")
    .execute();
  expect(events).toEqual([
    {
      action: "code.delivery-failed",
      detail: {
        kind: "email",
        purpose: "sign-in",
        requestId: result.requestId,
        error: "AccessDenied: Access denied to the sending role",
      },
    },
  ]);
  expect(JSON.stringify(events)).not.toContain("ana@example.com");
});

test("sends nothing when the browser is already signed in to the contact's account", async () => {
  const { createPersonAccount } = await import("@sharadox/account-web-library/person-account");
  const { signIn } = await import("@sharadox/account-web-library/account-sign-in");
  const created = await createPersonAccount(memory.database, {
    name: "Ana",
    identifier: "ana",
    contact: { kind: "email", value: "ana@example.com" },
  });
  if (!created.created) throw new Error("not created");
  const { token } = await signIn(memory.database, { accountId: created.accountId, now: 0 });
  const signedIn = (value: string, browser: string | undefined) =>
    solved().then((solution) =>
      startSignIn(server, {
        contact: { kind: "email", value },
        solution,
        address: "203.0.113.7",
        language: "en",
        token: browser,
        now: 0,
      }),
    );
  expect(await signedIn("ANA@example.com", token)).toEqual({ status: "signed-in", accountId: created.accountId });
  expect(await memory.database.selectFrom("code_request").select("id").execute()).toEqual([]);
  // Another browser, or another contact, still gets a code.
  expect((await signedIn("ana@example.com", undefined)).status).toBe("sent");
  expect((await signedIn("other@example.com", token)).status).toBe("sent");
  expect((await signedIn("ana@example.com", "an-unknown-token")).status).toBe("sent");
});
