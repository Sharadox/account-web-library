import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { listAccountSessions } from "@sharadox/account-web-library/account-session-list";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("lists the account's devices, newest activity first, marking the one asking, without ended ones", async () => {
  const { accountId } = await createTestPerson(memory.database, "ana");
  const other = await createTestPerson(memory.database, "bia");
  const phone = await signIn(memory.database, { accountId, userAgent: "Phone", now: 1_000 });
  const laptop = await signIn(memory.database, { accountId, userAgent: "Laptop", now: 2_000, secondFactor: true });
  await signIn(memory.database, { accountId: other.accountId, userAgent: "Elsewhere", now: 3_000 });
  await signIn(memory.database, { accountId, userAgent: "Old", now: 0, accountSessionSeconds: 1 });
  expect(await listAccountSessions(memory.database, { accountId, token: phone.token, now: 4_000 })).toEqual([
    {
      accountSessionId: laptop.accountSessionId,
      userAgent: "Laptop",
      signedInAt: new Date(2_000),
      lastSeenAt: new Date(2_000),
      secondFactor: true,
      current: false,
    },
    {
      accountSessionId: phone.accountSessionId,
      userAgent: "Phone",
      signedInAt: new Date(1_000),
      lastSeenAt: new Date(1_000),
      secondFactor: false,
      current: true,
    },
  ]);
  expect(await listAccountSessions(memory.database, { accountId, token: undefined, now: 4_000 })).toHaveLength(2);
  expect(await listAccountSessions(memory.database, { accountId, token: undefined })).toEqual([]);
});
