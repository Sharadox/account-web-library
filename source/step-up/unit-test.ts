import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import type { CodeDelivery } from "@sharadox/account-web-library/contact-channel/type";
import { finishStepUp, hasFreshStepUp, startStepUp } from "@sharadox/account-web-library/step-up";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let delivered: CodeDelivery[];
let accountId: string;
let contactId: string;
let token: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  delivered = [];
  server = {
    database: memory.database,
    channels: [{ kind: "email", send: async (delivery) => void delivered.push(delivery) }],
    secret: "a-root-secret-of-at-least-thirty-two-characters",
  };
  ({ accountId, contactId } = await createTestPerson(memory.database, "ana"));
  ({ token } = await signIn(memory.database, { accountId, now: 0 }));
});
afterEach(() => memory.close());

const start = async (now = 1_000) => {
  const result = await startStepUp(server, { accountId, contactId, address: "203.0.113.7", language: "en", now });
  if (result.status !== "sent") throw new Error(result.status);
  await result.deliver();
  return { requestId: result.requestId, code: delivered.at(-1)!.code };
};

test("a fresh code to one of the account's own contacts confirms it is them, for 10 minutes on this browser", async () => {
  expect(await hasFreshStepUp(memory.database, { accountId, token, now: 1_000 })).toBe(false);
  const { requestId, code } = await start();
  expect(delivered.at(-1)).toMatchObject({ purpose: "step-up", contact: { value: "ana@example.com" } });
  expect(await finishStepUp(server, { accountId, requestId, code, token, now: 2_000 })).toEqual({
    status: "confirmed",
  });
  expect(await hasFreshStepUp(memory.database, { accountId, token, now: 2_000 + 599_000 })).toBe(true);
  expect(await hasFreshStepUp(memory.database, { accountId, token, now: 2_000 + 601_000 })).toBe(false);
  expect(await hasFreshStepUp(memory.database, { accountId, token: undefined })).toBe(false);
});

test("refuses another account's contact, wrong codes, another account's code and a browser not signed in", async () => {
  const other = await createTestPerson(memory.database, "bia");
  expect(
    await startStepUp(server, { accountId, contactId: other.contactId, address: "203.0.113.7", language: "en" }),
  ).toEqual({ status: "refused", reason: "contact" });
  const { requestId, code } = await start();
  expect(await finishStepUp(server, { accountId, requestId, code: "000000", token, now: 2_000 })).toEqual({
    status: "refused",
    reason: "wrong",
  });
  const theirs = await signIn(memory.database, { accountId: other.accountId, now: 0 });
  expect(
    await finishStepUp(server, { accountId: other.accountId, requestId, code, token: theirs.token, now: 2_000 }),
  ).toEqual({
    status: "refused",
    reason: "unknown",
  });
  const again = await start(3_000);
  expect(await finishStepUp(server, { accountId, ...again, token: "not-a-session", now: 4_000 })).toEqual({
    status: "refused",
    reason: "session",
  });
});

test("a contact whose channel the server lacks can't be used", async () => {
  server.channels = [];
  expect(await startStepUp(server, { accountId, contactId, address: "203.0.113.7", language: "en" })).toEqual({
    status: "refused",
    reason: "contact",
  });
});
