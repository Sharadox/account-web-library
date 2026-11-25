import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import type { CodeDelivery } from "@sharadox/account-web-library/contact-channel/type";
import { finishContactAddition, startContactAddition } from "@sharadox/account-web-library/contact-addition-flow";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let delivered: CodeDelivery[];
let accountId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  delivered = [];
  server = {
    database: memory.database,
    channels: [{ kind: "email", send: async (delivery) => void delivered.push(delivery) }],
    secret: "a-root-secret-of-at-least-thirty-two-characters",
  };
  ({ accountId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

const add = (value: string, account = accountId) =>
  startContactAddition(server, {
    accountId: account,
    contact: { kind: "email", value },
    address: "203.0.113.7",
    language: "en",
    now: 1_000,
  });

test("adds a contact unverified, sends it a code, and verifies it when the code comes back", async () => {
  const result = await add(" New@Example.com ");
  if (result.status !== "sent") throw new Error(result.status);
  await result.deliver();
  expect(delivered.at(-1)).toMatchObject({ purpose: "contact-verification", contact: { value: "new@example.com" } });
  const code = delivered.at(-1)!.code;
  expect(
    await finishContactAddition(server, { accountId, requestId: result.requestId, code: "000000", now: 2_000 }),
  ).toEqual({
    status: "refused",
    reason: "wrong",
  });
  const finished = await finishContactAddition(server, { accountId, requestId: result.requestId, code, now: 2_000 });
  expect(finished).toEqual({ status: "verified", contactId: result.contactId, notify: expect.any(Function) });
  const notices: unknown[] = [];
  server.channels[0]!.notify = async (delivery) => void notices.push(delivery);
  if (finished.status === "verified") await finished.notify();
  expect(notices).toEqual([
    {
      contact: { kind: "email", value: "ana@example.com" },
      language: "en",
      notice: { kind: "contact-added", contact: "new@example.com" },
    },
  ]);
  const contact = await memory.database
    .selectFrom("contact")
    .select("verified_at")
    .where("id", "=", result.contactId)
    .executeTakeFirstOrThrow();
  expect(contact.verified_at).toEqual(new Date(2_000));
});

test("asking again for an unverified contact sends a new code to the same contact", async () => {
  const first = await add("new@example.com");
  const second = await add("new@example.com");
  if (first.status !== "sent" || second.status !== "sent") throw new Error("not sent");
  expect(second.contactId).toBe(first.contactId);
});

test("refuses invalid contacts, ones already verified here or elsewhere, and codes for another account", async () => {
  expect(await add("not an email")).toEqual({ status: "refused", reason: "contact" });
  expect(await add("ana@example.com")).toEqual({ status: "refused", reason: "already-added" });
  await createTestPerson(memory.database, "bia");
  expect(await add("bia@example.com")).toEqual({ status: "refused", reason: "contact-taken" });
  server.channels = [];
  expect(await add("other@example.com")).toEqual({ status: "refused", reason: "contact" });
});

test("a code proves the contact only for the account that asked", async () => {
  const result = await add("new@example.com");
  if (result.status !== "sent") throw new Error(result.status);
  await result.deliver();
  const other = await createTestPerson(memory.database, "bia");
  expect(
    await finishContactAddition(server, {
      accountId: other.accountId,
      requestId: result.requestId,
      code: delivered.at(-1)!.code,
      now: 2_000,
    }),
  ).toEqual({ status: "refused", reason: "unknown" });
});

test("passes on rate limits, and refuses a contact removed or verified by another account meanwhile", async () => {
  server.limits = { perContact: { capacity: 1, refillPerSecond: 0.0001 } };
  expect((await add("limited@example.com")).status).toBe("sent");
  expect(await add("limited@example.com")).toMatchObject({ status: "refused", reason: "rate-limit" });
  server.limits = {};
  const removed = await add("removed@example.com");
  if (removed.status !== "sent") throw new Error(removed.status);
  await removed.deliver();
  const removedCode = delivered.at(-1)!.code;
  await memory.database.deleteFrom("contact").where("id", "=", removed.contactId).execute();
  expect(
    await finishContactAddition(server, { accountId, requestId: removed.requestId, code: removedCode, now: 2_000 }),
  ).toEqual({
    status: "refused",
    reason: "no-contact",
  });
  const taken = await add("taken@example.com");
  if (taken.status !== "sent") throw new Error(taken.status);
  await taken.deliver();
  const takenCode = delivered.at(-1)!.code;
  const { accountId: other } = await createTestPerson(memory.database, "bia");
  await memory.database
    .updateTable("contact")
    .set({ value: "taken@example.com" })
    .where("account_id", "=", other)
    .execute();
  expect(
    await finishContactAddition(server, { accountId, requestId: taken.requestId, code: takenCode, now: 2_000 }),
  ).toEqual({
    status: "refused",
    reason: "contact-taken",
  });
});

test("a contact of a deleted, banned account can't be added", async () => {
  const { deriveSecret } = await import("@sharadox/account-web-library/secret-derivation");
  const { bannedContactHash } = await import("@sharadox/account-web-library/banned-contact");
  await memory.database
    .insertInto("banned_contact")
    .values({
      id: "0198f5a2-7a4c-7000-8000-000000000001",
      contact_hash: bannedContactHash(
        { kind: "email", value: "gone@example.com" },
        deriveSecret(server.secret, "banned-contact"),
      ),
      application_id: null,
      ends_at: null,
      rule_codes: ["fraud"],
    })
    .execute();
  expect(await add("gone@example.com")).toEqual({ status: "refused", reason: "contact-banned" });
});
