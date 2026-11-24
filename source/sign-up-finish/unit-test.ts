import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { readBrowserSession } from "@sharadox/account-web-library/browser-session-read";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { createTicket } from "@sharadox/account-web-library/signed-ticket";
import { finishSignUp } from "@sharadox/account-web-library/sign-up-finish";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

const secret = "a-root-secret-of-at-least-thirty-two-characters";
let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  server = { database: memory.database, channels: [], secret };
});
afterEach(() => memory.close());

const ticket = (value: string, now = 0) =>
  createTicket(
    { contact: { kind: "email", value } },
    { secret: deriveSecret(secret, "sign-up-ticket"), purpose: "sign-up", lifetimeSeconds: 900, now },
  );

test("creates the account with the proved contact and signs it in", async () => {
  const result = await finishSignUp(server, {
    ticket: ticket("ana@example.com"),
    username: "Ana",
    token: undefined,
    now: 1_000,
  });
  if (result.status !== "signed-in") throw new Error(result.status);
  const session = await readBrowserSession(memory.database, { token: result.token, now: 2_000 });
  expect(session!.accounts).toMatchObject([{ accountId: result.accountId, username: "Ana" }]);
  const contact = await memory.database
    .selectFrom("contact")
    .select(["value", "verified_at"])
    .executeTakeFirstOrThrow();
  expect(contact).toEqual({ value: "ana@example.com", verified_at: new Date(1_000) });
});

test("refuses forged or expired tickets", async () => {
  expect(await finishSignUp(server, { ticket: "forged.ticket", username: "Ana", token: undefined, now: 0 })).toEqual({
    status: "refused",
    reason: "ticket",
  });
  expect(
    await finishSignUp(server, { ticket: ticket("a@example.com", 0), username: "Ana", token: undefined, now: 900_000 }),
  ).toEqual({
    status: "refused",
    reason: "ticket",
  });
});

test("passes on why the account couldn't be made, so the person can choose another username", async () => {
  expect(
    await finishSignUp(server, { ticket: ticket("a@example.com"), username: "a--b", token: undefined, now: 0 }),
  ).toEqual({
    status: "refused",
    reason: "username-invalid",
  });
  await finishSignUp(server, { ticket: ticket("a@example.com"), username: "abc", token: undefined, now: 0 });
  expect(
    await finishSignUp(server, { ticket: ticket("b@example.com"), username: "ABC", token: undefined, now: 0 }),
  ).toEqual({
    status: "refused",
    reason: "username-taken",
  });
  // A ticket used twice can't make a second account with the same contact.
  expect(
    await finishSignUp(server, { ticket: ticket("a@example.com"), username: "other", token: undefined, now: 0 }),
  ).toEqual({
    status: "refused",
    reason: "contact-taken",
  });
});

test("uses the current time by default", async () => {
  const result = await finishSignUp(server, {
    ticket: ticket("a@example.com", Date.now()),
    username: "Ana",
    token: undefined,
  });
  expect(result.status).toBe("signed-in");
});
