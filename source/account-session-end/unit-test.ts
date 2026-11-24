import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { endAccountSession } from "@sharadox/account-web-library/account-session-end";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("signs the account out on one device only, and records it", async () => {
  const { accountId } = await createTestPerson(memory.database, "ana");
  const phone = await signIn(memory.database, { accountId, now: 1_000 });
  const laptop = await signIn(memory.database, { accountId, now: 2_000 });
  expect(await endAccountSession(memory.database, { accountId, accountSessionId: phone.accountSessionId })).toEqual({
    ended: true,
  });
  expect(await memory.database.selectFrom("account_session").select("id").execute()).toEqual([
    { id: laptop.accountSessionId },
  ]);
  const events = await memory.database
    .selectFrom("audit_event")
    .select("detail")
    .where("action", "=", "session.ended")
    .execute();
  expect(events).toEqual([{ detail: { accountSessionId: phone.accountSessionId } }]);
});

test("can't end another account's session", async () => {
  const { accountId } = await createTestPerson(memory.database, "ana");
  const other = await createTestPerson(memory.database, "bia");
  const theirs = await signIn(memory.database, { accountId: other.accountId });
  expect(await endAccountSession(memory.database, { accountId, accountSessionId: theirs.accountSessionId })).toEqual({
    ended: false,
  });
  expect(await memory.database.selectFrom("account_session").select("id").execute()).toHaveLength(1);
});
