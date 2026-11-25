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
    name: "Ana Silva",
    ticket: ticket("ana@example.com"),
    identifier: "Ana",
    token: undefined,
    userAgent: "Laptop",
    language: "pt-PT",
    now: 1_000,
  });
  const browser = await memory.database.selectFrom("browser_session").select("user_agent").executeTakeFirst();
  expect(browser?.user_agent).toBe("Laptop");
  expect(await memory.database.selectFrom("account").select("language").execute()).toEqual([{ language: "pt-PT" }]);
  if (result.status !== "signed-in") throw new Error(result.status);
  const session = await readBrowserSession(memory.database, { token: result.token, now: 2_000 });
  expect(session!.accounts).toMatchObject([{ accountId: result.accountId, identifier: "Ana", name: "Ana Silva" }]);
  const contact = await memory.database
    .selectFrom("contact")
    .select(["value", "verified_at"])
    .executeTakeFirstOrThrow();
  expect(contact).toEqual({ value: "ana@example.com", verified_at: new Date(1_000) });
});

test("refuses forged or expired tickets", async () => {
  expect(
    await finishSignUp(server, { name: "Ana", ticket: "forged.ticket", identifier: "Ana", token: undefined, now: 0 }),
  ).toEqual({
    status: "refused",
    reason: "ticket",
  });
  expect(
    await finishSignUp(server, {
      name: "Ana",
      ticket: ticket("a@example.com", 0),
      identifier: "Ana",
      token: undefined,
      now: 900_000,
    }),
  ).toEqual({
    status: "refused",
    reason: "ticket",
  });
});

test("passes on why the account couldn't be made, so the person can choose another identifier", async () => {
  expect(
    await finishSignUp(server, {
      name: "Ana",
      ticket: ticket("a@example.com"),
      identifier: "a--b",
      token: undefined,
      now: 0,
    }),
  ).toEqual({
    status: "refused",
    reason: "identifier-invalid",
  });
  await finishSignUp(server, {
    name: "Ana",
    ticket: ticket("a@example.com"),
    identifier: "abc",
    token: undefined,
    now: 0,
  });
  expect(
    await finishSignUp(server, {
      name: "Ana",
      ticket: ticket("b@example.com"),
      identifier: "ABC",
      token: undefined,
      now: 0,
    }),
  ).toEqual({
    status: "refused",
    reason: "identifier-taken",
  });
  // A ticket used twice can't make a second account with the same contact.
  expect(
    await finishSignUp(server, {
      name: "Ana",
      ticket: ticket("a@example.com"),
      identifier: "other",
      token: undefined,
      now: 0,
    }),
  ).toEqual({
    status: "refused",
    reason: "contact-taken",
  });
});

test("uses the current time by default", async () => {
  const result = await finishSignUp(server, {
    name: "Ana Silva",
    ticket: ticket("a@example.com", Date.now()),
    identifier: "Ana",
    token: undefined,
  });
  expect(result.status).toBe("signed-in");
});

test("refuses a name outside the rules, keeping the ticket usable", async () => {
  const proof = ticket("a@example.com");
  expect(await finishSignUp(server, { name: " ", ticket: proof, identifier: "abc", token: undefined, now: 0 })).toEqual(
    {
      status: "refused",
      reason: "name-invalid",
    },
  );
  expect(
    (await finishSignUp(server, { name: "Abc", ticket: proof, identifier: "abc", token: undefined, now: 0 })).status,
  ).toBe("signed-in");
});

test("a contact of a deleted account banned from the account system can't sign up again while the ban lasts", async () => {
  const { deriveSecret: derive } = await import("@sharadox/account-web-library/secret-derivation");
  const { bannedContactHash } = await import("@sharadox/account-web-library/banned-contact");
  await memory.database
    .insertInto("banned_contact")
    .values({
      id: "0198f5a2-7a4c-7000-8000-000000000001",
      contact_hash: bannedContactHash({ kind: "email", value: "gone@example.com" }, derive(secret, "banned-contact")),
      application_id: null,
      ends_at: null,
      rule_codes: ["fraud"],
    })
    .execute();
  expect(
    await finishSignUp(server, {
      name: "Gone",
      ticket: ticket("gone+again@example.com"),
      identifier: "gone",
      token: undefined,
      now: 0,
    }),
  ).toEqual({ status: "refused", reason: "contact-banned" });
});
