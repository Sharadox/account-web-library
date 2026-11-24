import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { readBrowserSession } from "@sharadox/account-web-library/browser-session-read";
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

const day = 86_400_000;

test("lists the accounts signed in on the browser, in the order they signed in, and marks it seen", async () => {
  const one = await person("one");
  const two = await person("Two");
  const first = await signIn(memory.database, { accountId: one, now: 1_000 });
  const second = await signIn(memory.database, { accountId: two, token: first.token, now: 2_000, secondFactor: true });
  expect(await readBrowserSession(memory.database, { token: second.token, now: 3_000 })).toEqual({
    browserSessionId: second.browserSessionId,
    accounts: [
      {
        accountSessionId: first.accountSessionId,
        accountId: one,
        username: "one",
        signedInAt: new Date(1_000),
        secondFactorAt: null,
      },
      {
        accountSessionId: second.accountSessionId,
        accountId: two,
        username: "Two",
        signedInAt: new Date(2_000),
        secondFactorAt: new Date(2_000),
      },
    ],
  });
  const browser = await memory.database.selectFrom("browser_session").select("last_seen_at").executeTakeFirstOrThrow();
  expect(browser.last_seen_at).toEqual(new Date(3_000));
  const seen = await memory.database.selectFrom("account_session").select("last_seen_at").execute();
  expect(seen.map(({ last_seen_at }) => last_seen_at)).toEqual([new Date(3_000), new Date(3_000)]);
});

test("leaves out account sessions past their end or idle too long", async () => {
  const one = await person("one");
  const two = await person("two");
  const first = await signIn(memory.database, { accountId: one, now: 0, accountSessionSeconds: 10 });
  const second = await signIn(memory.database, { accountId: two, token: first.token, now: 0 });
  expect(
    (await readBrowserSession(memory.database, { token: second.token, now: 11_000 }))!.accounts.map(
      ({ accountId }) => accountId,
    ),
  ).toEqual([two]);
  expect((await readBrowserSession(memory.database, { token: second.token, now: 11_000 + 8 * day }))!.accounts).toEqual(
    [],
  );
  const late = await readBrowserSession(memory.database, {
    token: second.token,
    now: 11_000 + 8 * day,
    idleSeconds: 9 * 86_400,
  });
  expect(late!.accounts.map(({ accountId }) => accountId)).toEqual([two]);
});

test("is undefined for an unknown, missing or expired token", async () => {
  const first = await signIn(memory.database, { accountId: await person("one"), now: 0 });
  expect(await readBrowserSession(memory.database, { token: "unknown" })).toBeUndefined();
  expect(await readBrowserSession(memory.database, { token: undefined })).toBeUndefined();
  expect(await readBrowserSession(memory.database, { token: first.token, now: 401 * day })).toBeUndefined();
});

test("uses the current time by default", async () => {
  const first = await signIn(memory.database, { accountId: await person("one") });
  expect((await readBrowserSession(memory.database, { token: first.token }))!.accounts).toHaveLength(1);
});
