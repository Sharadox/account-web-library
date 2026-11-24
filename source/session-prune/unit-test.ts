import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { pruneSessions } from "@sharadox/account-web-library/session-prune";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

const day = 86_400_000;

test("deletes ended and idle account sessions, and browser sessions that ended or hold no account", async () => {
  const result = await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "one",
    contact: { kind: "email", value: "one@example.com" },
  });
  if (!result.created) throw new Error("not created");
  const { accountId } = result;
  await signIn(memory.database, { accountId, now: 0 }); // idle for 8 days by then
  const fresh = await signIn(memory.database, { accountId, now: 7 * day });
  expect(await pruneSessions(memory.database, { now: 8 * day })).toEqual({ accountSessions: 1, browserSessions: 1 });
  expect(await memory.database.selectFrom("browser_session").select("id").execute()).toEqual([
    { id: fresh.browserSessionId },
  ]);
  expect(await pruneSessions(memory.database, { now: 8 * day, idleSeconds: 1 })).toEqual({
    accountSessions: 1,
    browserSessions: 1,
  });
});

test("uses the current time by default", async () => {
  expect(await pruneSessions(memory.database)).toEqual({ accountSessions: 0, browserSessions: 0 });
});
