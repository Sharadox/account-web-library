import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { exportAccount } from "@sharadox/account-web-library/account-export";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("gives everything stored about the account, and no secrets", async () => {
  const { accountId, contactId } = await createTestPerson(memory.database, "ana", 1_000);
  await signIn(memory.database, { accountId, userAgent: "Phone", now: 2_000 });
  const data = await exportAccount(memory.database, { accountId, now: 3_000 });
  expect(data).toMatchObject({
    exportedAt: new Date(3_000).toISOString(),
    account: {
      id: accountId,
      kind: "person",
      name: "ana",
      identifier: "ana",
      createdAt: new Date(1_000).toISOString(),
    },
    contacts: [{ id: contactId, kind: "email", value: "ana@example.com", signIn: true }],
    picture: null,
    secondFactor: { authenticatorApp: false, recoveryCodesLeft: 0 },
    sessions: [{ userAgent: "Phone", signedInAt: new Date(2_000).toISOString() }],
  });
  expect(data!.activity.map(({ action }) => action)).toEqual(["session.signed-in", "account.created"]);
  expect(JSON.stringify(data)).not.toMatch(/token|hash|secret_ciphertext/);
});

test("is undefined for an account that doesn't exist", async () => {
  expect(await exportAccount(memory.database, { accountId: "0198f5a2-7a4c-7000-8000-000000000009" })).toBeUndefined();
});

test("includes the picture and contacts not yet verified", async () => {
  const { accountId } = await createTestPerson(memory.database, "ana", 1_000);
  const { addContact } = await import("@sharadox/account-web-library/contact-addition");
  await addContact(memory.database, { accountId, contact: { kind: "email", value: "new@example.com" }, now: 2_000 });
  const pictureId = "0198f5a2-7a4c-7000-8000-00000000000a";
  await memory.database
    .insertInto("account_picture")
    .values({
      id: pictureId,
      account_id: accountId,
      content_type: "image/webp",
      byte_size: 3,
      width: 2,
      height: 1,
      created_at: new Date(3_000),
    })
    .execute();
  const data = await exportAccount(memory.database, { accountId });
  expect(data!.picture).toEqual({ id: pictureId, width: 2, height: 1, createdAt: new Date(3_000).toISOString() });
  expect(data!.contacts.map(({ verifiedAt }) => verifiedAt)).toEqual([new Date(1_000).toISOString(), null]);
});
