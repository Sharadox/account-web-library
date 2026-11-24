import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { revokeAccountSessions } from "@sharadox/account-web-library/account-session-revocation";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
const person = async (username: string) => {
  const result = await createPersonAccount(memory.database, {
    username,
    contact: { kind: "email", value: `${username}@example.com` },
  });
  if (!result.created) throw new Error("not created");
  return result.accountId;
};
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("signs an account out on every browser, records who did it, and leaves other accounts alone", async () => {
  const one = await person("one");
  const two = await person("two");
  const browser = await signIn(memory.database, { accountId: one });
  await signIn(memory.database, { accountId: two, token: browser.token });
  await signIn(memory.database, { accountId: one });
  expect(await revokeAccountSessions(memory.database, { accountId: one, actorAccountId: two })).toBe(2);
  expect(await memory.database.selectFrom("account_session").select("account_id").execute()).toEqual([
    { account_id: two },
  ]);
  expect(
    await memory.database
      .selectFrom("audit_event")
      .select(["account_id", "actor_account_id"])
      .where("action", "=", "session.revoked")
      .execute(),
  ).toEqual([{ account_id: one, actor_account_id: two }]);
});

test("the actor is optional", async () => {
  const one = await person("one");
  await signIn(memory.database, { accountId: one });
  expect(await revokeAccountSessions(memory.database, { accountId: one })).toBe(1);
});
