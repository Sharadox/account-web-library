import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { signOut } from "@sharadox/account-web-library/account-sign-out";
import { readBrowserSession } from "@sharadox/account-web-library/browser-session-read";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
const person = async (identifier: string) => {
  const result = await createPersonAccount(memory.database, {
    name: "A Person",
    identifier,
    contact: { kind: "email", value: `${identifier}@example.com` },
  });
  if (!result.created) throw new Error("not created");
  return result.accountId;
};
let one: string;
let two: string;
let token: string;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  one = await person("one");
  two = await person("two");
  const first = await signIn(memory.database, { accountId: one });
  token = (await signIn(memory.database, { accountId: two, token: first.token })).token;
});
afterEach(() => memory.close());

test("signs one account out of the browser and leaves the others", async () => {
  expect(await signOut(memory.database, { token, accountId: one })).toEqual({ signedOut: [one] });
  expect((await readBrowserSession(memory.database, { token }))!.accounts.map(({ accountId }) => accountId)).toEqual([
    two,
  ]);
  expect(
    await memory.database
      .selectFrom("audit_event")
      .select("account_id")
      .where("action", "=", "session.signed-out")
      .execute(),
  ).toEqual([{ account_id: one }]);
});

test("signs every account out and ends the browser session", async () => {
  expect((await signOut(memory.database, { token })).signedOut.sort()).toEqual([one, two].sort());
  expect(await readBrowserSession(memory.database, { token })).toBeUndefined();
  expect(await memory.database.selectFrom("account_session").select("id").execute()).toEqual([]);
});

test("does nothing for an unknown token or an account not signed in there", async () => {
  expect(await signOut(memory.database, { token: "unknown" })).toEqual({ signedOut: [] });
  expect(await signOut(memory.database, { token: undefined })).toEqual({ signedOut: [] });
  expect(await signOut(memory.database, { token, accountId: "0198f5a2-7a4c-7000-8000-000000000009" })).toEqual({
    signedOut: [],
  });
});
