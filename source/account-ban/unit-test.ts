import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountPermissions } from "@sharadox/account-web-library/account-permission";
import { appealBan, banAccount, decideAppeal, listBans } from "@sharadox/account-web-library/account-ban";
import { syncApplication } from "@sharadox/account-web-library/application-sync";
import { grantRole } from "@sharadox/account-web-library/role-grant";
import { syncRules } from "@sharadox/account-web-library/rule-sync";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

const DAY = 86_400;
let memory: MemoryDatabase<AccountDatabase>;
let ana: string;
let moderator: string;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  await syncApplication(memory.database, {
    key: "platform",
    name: "Platform",
    permissions: [
      { key: "platform.job.read", description: "" },
      { key: "platform.appeal.create", description: "" },
    ],
    roles: [
      { key: "member", name: "Member", permissions: ["platform.job.read"], default: true },
      { key: "banned", name: "Banned", permissions: ["platform.appeal.create"], exclusive: true },
    ],
  });
  await syncApplication(memory.database, {
    key: "account",
    name: "Account",
    permissions: [
      { key: "account.ban.create", description: "" },
      { key: "account.appeal.decide", description: "" },
    ],
    roles: [{ key: "moderator", name: "Moderator", permissions: ["account.ban.create", "account.appeal.decide"] }],
  });
  await syncRules(memory.database, {
    application: "platform",
    rules: [
      { code: "spam", title: { en: "No spam" }, description: { en: "" }, schedule: [7 * DAY, 30 * DAY, "permanent"] },
      { code: "abuse", title: { en: "No abuse" }, description: { en: "" }, schedule: [14 * DAY] },
    ],
  });
  ({ accountId: ana } = await createTestPerson(memory.database, "ana"));
  ({ accountId: moderator } = await createTestPerson(memory.database, "moderator"));
  await grantRole(memory.database, { accountId: moderator, application: "account", role: "moderator" });
});
afterEach(() => memory.close());

const ban = (rules: string[], now = 0, by: string | undefined = moderator) =>
  banAccount(memory.database, { accountId: ana, application: "platform", rules, statement: "Posted spam.", by, now });

test("a ban lasts what its rules say for this offense, the longest when several, and leaves only the ban role", async () => {
  const first = await ban(["spam", "abuse"]);
  expect(first).toEqual({ banned: true, banId: expect.any(String), endsAt: new Date(14 * DAY * 1000) });
  expect([...(await accountPermissions(memory.database, { accountId: ana, application: "platform", now: 1 }))]).toEqual(
    ["platform.appeal.create"],
  );
  const second = await ban(["spam"], 20 * DAY * 1000);
  expect(second).toMatchObject({ endsAt: new Date((20 + 30) * DAY * 1000) });
  const third = await ban(["spam"], 60 * DAY * 1000);
  expect(third).toMatchObject({ endsAt: null });
  const bans = await listBans(memory.database, { accountId: ana, now: 60 * DAY * 1000 });
  expect(bans.map(({ rules, penalty, active }) => [rules, penalty, active])).toEqual([
    [["spam"], "permanent", true],
    [["spam"], String(30 * DAY), false],
    [["abuse", "spam"], String(14 * DAY), false],
  ]);
});

test("only a moderator bans, citing rules that exist; the system may too", async () => {
  expect(await ban(["spam"], 0, ana)).toEqual({ banned: false, reason: "not-allowed" });
  expect(await ban(["nothing"])).toEqual({ banned: false, reason: "no-rule", detail: "nothing" });
  expect(await ban([])).toEqual({ banned: false, reason: "no-rule", detail: "" });
  expect((await ban(["spam"], 0, undefined)).banned).toBe(true);
  expect(
    await banAccount(memory.database, {
      accountId: ana,
      application: "account",
      rules: ["spam"],
      statement: "x",
      by: moderator,
    }),
  ).toEqual({ banned: false, reason: "no-rule", detail: "spam" });
});

test("an application without an exclusive role can't ban", async () => {
  await syncRules(memory.database, {
    application: "account",
    rules: [{ code: "spam", title: {}, description: {}, schedule: [1] }],
  });
  expect(
    await banAccount(memory.database, {
      accountId: ana,
      application: "account",
      rules: ["spam"],
      statement: "x",
      by: moderator,
    }),
  ).toEqual({ banned: false, reason: "no-ban-role" });
});

test("one appeal per ban, by the banned account; lifted ends it, shortened moves its end, upheld keeps it", async () => {
  const first = await ban(["spam"], 0);
  if (!first.banned) throw new Error(first.reason);
  expect(await appealBan(memory.database, { banId: first.banId, accountId: moderator, text: "Not mine" })).toEqual({
    appealed: false,
    reason: "no-ban",
  });
  const appeal = await appealBan(memory.database, { banId: first.banId, accountId: ana, text: "It was a mistake." });
  if (!appeal.appealed) throw new Error(appeal.reason);
  expect(await appealBan(memory.database, { banId: first.banId, accountId: ana, text: "Again" })).toEqual({
    appealed: false,
    reason: "already-appealed",
  });
  expect(
    await decideAppeal(memory.database, { appealId: appeal.appealId, by: ana, decision: "lifted", reasons: "x" }),
  ).toEqual({ decided: false, reason: "not-allowed" });
  expect(
    await decideAppeal(memory.database, {
      appealId: appeal.appealId,
      by: moderator,
      decision: "shortened",
      reasons: "First time.",
      endsAt: 2 * DAY * 1000,
      now: 1_000,
    }),
  ).toEqual({ decided: true });
  expect((await listBans(memory.database, { accountId: ana, now: 1_000 }))[0]).toMatchObject({
    endsAt: new Date(2 * DAY * 1000),
    appeal: { text: "It was a mistake.", decision: "shortened", reasons: "First time." },
  });
  expect(
    await decideAppeal(memory.database, { appealId: appeal.appealId, by: moderator, decision: "upheld", reasons: "x" }),
  ).toEqual({ decided: false, reason: "already-decided" });
  const second = await ban(["abuse"], 3 * DAY * 1000);
  if (!second.banned) throw new Error(second.reason);
  const other = await appealBan(memory.database, { banId: second.banId, accountId: ana, text: "Please" });
  if (!other.appealed) throw new Error(other.reason);
  await decideAppeal(memory.database, {
    appealId: other.appealId,
    by: moderator,
    decision: "lifted",
    reasons: "Wrong account.",
    now: 4 * DAY * 1000,
  });
  expect((await listBans(memory.database, { accountId: ana, now: 5 * DAY * 1000 }))[0]!.active).toBe(false);
  const third = await ban(["abuse"], 6 * DAY * 1000);
  if (!third.banned) throw new Error(third.reason);
  const kept = await appealBan(memory.database, { banId: third.banId, accountId: ana, text: "Again?" });
  if (!kept.appealed) throw new Error(kept.reason);
  expect(
    await decideAppeal(memory.database, {
      appealId: kept.appealId,
      by: moderator,
      decision: "upheld",
      reasons: "Repeated.",
    }),
  ).toEqual({
    decided: true,
  });
  expect(
    await decideAppeal(memory.database, {
      appealId: "0198f5a2-7a4c-7000-8000-000000000009",
      by: moderator,
      decision: "upheld",
      reasons: "",
    }),
  ).toEqual({
    decided: false,
    reason: "no-appeal",
  });
});
