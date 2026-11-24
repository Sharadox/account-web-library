import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { hashSessionToken } from "@sharadox/account-web-library/session-token";
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
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("signs in on a new browser: a browser session, an account session, and a token to set as the cookie", async () => {
  const accountId = await person("luis");
  const result = await signIn(memory.database, { accountId, now: 1_000 });
  const browser = await memory.database.selectFrom("browser_session").selectAll().executeTakeFirstOrThrow();
  expect(browser).toEqual({
    id: result.browserSessionId,
    token_hash: hashSessionToken(result.token),
    created_at: new Date(1_000),
    last_seen_at: new Date(1_000),
    expires_at: new Date(1_000 + 400 * 86_400_000),
    user_agent: null,
  });
  const session = await memory.database.selectFrom("account_session").selectAll().executeTakeFirstOrThrow();
  expect(session).toEqual({
    id: result.accountSessionId,
    browser_session_id: result.browserSessionId,
    account_id: accountId,
    created_at: new Date(1_000),
    last_seen_at: new Date(1_000),
    expires_at: new Date(1_000 + 30 * 86_400_000),
    second_factor_at: null,
    step_up_at: null,
  });
  expect(
    await memory.database
      .selectFrom("audit_event")
      .select("action")
      .where("action", "=", "session.signed-in")
      .execute(),
  ).toHaveLength(1);
});

test("adds another account to the same browser and gives the browser a new token each time", async () => {
  const first = await signIn(memory.database, { accountId: await person("one"), now: 1_000 });
  const second = await signIn(memory.database, { accountId: await person("two"), token: first.token, now: 2_000 });
  expect(second.browserSessionId).toBe(first.browserSessionId);
  expect(second.token).not.toBe(first.token);
  expect(await memory.database.selectFrom("browser_session").select("token_hash").execute()).toEqual([
    { token_hash: hashSessionToken(second.token) },
  ]);
  expect(await memory.database.selectFrom("account_session").select("id").execute()).toHaveLength(2);
});

test("signing in again with the same account replaces its session there", async () => {
  const accountId = await person("luis");
  const first = await signIn(memory.database, { accountId, now: 1_000, secondFactor: true });
  const again = await signIn(memory.database, { accountId, token: first.token, now: 5_000 });
  const sessions = await memory.database.selectFrom("account_session").selectAll().execute();
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({
    id: again.accountSessionId,
    created_at: new Date(5_000),
    second_factor_at: null,
    step_up_at: null,
  });
});

test("records two-factor when it was passed", async () => {
  const accountId = await person("luis");
  await signIn(memory.database, { accountId, now: 1_000, secondFactor: true });
  const session = await memory.database.selectFrom("account_session").selectAll().executeTakeFirstOrThrow();
  expect(session.second_factor_at).toEqual(new Date(1_000));
});

test("an unknown or expired token starts a new browser session", async () => {
  const accountId = await person("luis");
  const first = await signIn(memory.database, { accountId, now: 0 });
  const unknown = await signIn(memory.database, { accountId, token: "unknown", now: 1_000 });
  expect(unknown.browserSessionId).not.toBe(first.browserSessionId);
  const late = await signIn(memory.database, { accountId, token: unknown.token, now: 1_000 + 401 * 86_400_000 });
  expect(late.browserSessionId).not.toBe(unknown.browserSessionId);
});

test("takes custom lifetimes and uses the current time by default", async () => {
  const accountId = await person("luis");
  await signIn(memory.database, { accountId, accountSessionSeconds: 3_600, browserSessionSeconds: 7_200 });
  const session = await memory.database.selectFrom("account_session").selectAll().executeTakeFirstOrThrow();
  expect(session.expires_at.getTime() - session.created_at.getTime()).toBe(3_600_000);
  expect(Math.abs(session.created_at.getTime() - Date.now())).toBeLessThan(10_000);
  const browser = await memory.database.selectFrom("browser_session").selectAll().executeTakeFirstOrThrow();
  expect(browser.expires_at.getTime() - browser.created_at.getTime()).toBe(7_200_000);
});

test("remembers the browser's description, trimmed to 500 characters, for the list of devices", async () => {
  const created = await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "device",
    contact: { kind: "email", value: "device@example.com" },
  });
  if (!created.created) throw new Error("not created");
  const first = await signIn(memory.database, { accountId: created.accountId, userAgent: "Firefox", now: 0 });
  await signIn(memory.database, {
    accountId: created.accountId,
    token: first.token,
    userAgent: "x".repeat(600),
    now: 1,
  });
  const browser = await memory.database.selectFrom("browser_session").select("user_agent").executeTakeFirstOrThrow();
  expect(browser.user_agent).toBe("x".repeat(500));
});
