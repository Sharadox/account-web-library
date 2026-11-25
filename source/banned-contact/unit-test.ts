import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { banAccount } from "@sharadox/account-web-library/account-ban";
import { deleteAccount } from "@sharadox/account-web-library/account-deletion";
import { syncApplication } from "@sharadox/account-web-library/application-sync";
import { contactBanned, pruneBannedContacts } from "@sharadox/account-web-library/banned-contact";
import { createMemoryPictureStorage } from "@sharadox/account-web-library/memory-picture-storage";
import { syncRules } from "@sharadox/account-web-library/rule-sync";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

const pepper = "a-ledger-pepper-of-at-least-thirty-two-characters";
let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  await syncApplication(memory.database, {
    key: "platform",
    name: "Platform",
    permissions: [],
    roles: [{ key: "banned", name: "Banned", permissions: [], exclusive: true }],
  });
  await syncRules(memory.database, {
    application: "platform",
    rules: [
      { code: "spam", title: {}, description: {}, schedule: [10] },
      { code: "fraud", title: {}, description: {}, schedule: ["permanent"] },
    ],
  });
});
afterEach(() => memory.close());

test("deleting a banned account keeps its contacts' HMACs until the ban ends, +tags ignored", async () => {
  const { accountId } = await createTestPerson(memory.database, "Ana");
  await banAccount(memory.database, { accountId, application: "platform", rules: ["spam"], statement: "x", now: 0 });
  await deleteAccount(memory.database, createMemoryPictureStorage(), { accountId, ledgerPepper: pepper, now: 1_000 });
  const ledger = await memory.database.selectFrom("banned_contact").selectAll().execute();
  expect(ledger).toHaveLength(1);
  expect(ledger[0]!.contact_hash).not.toContain("ana");
  expect(ledger[0]).toMatchObject({ ends_at: new Date(10_000), rule_codes: ["spam"] });
  const check = (value: string, now: number, application = "platform") =>
    contactBanned(memory.database, { contact: { kind: "email", value }, pepper, application, now });
  expect(await check("ANA+new@example.com", 5_000)).toBe(true);
  expect(await check("ana@example.com", 5_000, "account")).toBe(false);
  expect(await check("ana@example.com", 11_000)).toBe(false);
  expect(await check("bia@example.com", 5_000)).toBe(false);
  expect(await pruneBannedContacts(memory.database, { now: 11_000 })).toBe(1);
});

test("a permanent ban stays for good; an account without bans leaves nothing", async () => {
  const { accountId } = await createTestPerson(memory.database, "cid");
  await banAccount(memory.database, { accountId, application: "platform", rules: ["fraud"], statement: "x", now: 0 });
  await deleteAccount(memory.database, createMemoryPictureStorage(), { accountId, ledgerPepper: pepper });
  const { accountId: clean } = await createTestPerson(memory.database, "dan");
  await deleteAccount(memory.database, createMemoryPictureStorage(), { accountId: clean, ledgerPepper: pepper });
  expect(await memory.database.selectFrom("banned_contact").select("ends_at").execute()).toEqual([{ ends_at: null }]);
  expect(await pruneBannedContacts(memory.database)).toBe(0);
  expect(
    await contactBanned(memory.database, {
      contact: { kind: "email", value: "cid@example.com" },
      pepper,
      application: "platform",
    }),
  ).toBe(true);
  expect(
    await contactBanned(memory.database, {
      contact: { kind: "email", value: "not an email" },
      pepper,
      application: "platform",
    }),
  ).toBe(false);
});
