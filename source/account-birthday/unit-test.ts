import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountBirthday, checkBirthday, setBirthday } from "@sharadox/account-web-library/account-birthday";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

const now = Date.parse("2026-11-25T12:00:00Z");
let memory: MemoryDatabase<AccountServerDatabase>;
let accountId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  ({ accountId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

test("a birthday is a real day and month, the year optional", () => {
  expect(checkBirthday({ day: 29, month: 2 }, { now })).toEqual({ valid: true });
  expect(checkBirthday({ day: 29, month: 2, year: 2000 }, { now })).toEqual({ valid: true });
  expect(checkBirthday({ day: 29, month: 2, year: 2001 }, { now })).toEqual({ valid: false, reason: "date" });
  expect(checkBirthday({ day: 31, month: 4 }, { now })).toEqual({ valid: false, reason: "date" });
  expect(checkBirthday({ day: 0, month: 1 }, { now })).toEqual({ valid: false, reason: "date" });
  expect(checkBirthday({ day: 1.5, month: 1 }, { now })).toEqual({ valid: false, reason: "date" });
  expect(checkBirthday({ day: 1, month: 13 }, { now })).toEqual({ valid: false, reason: "date" });
  expect(checkBirthday({ day: 1, month: 1, year: 1899 }, { now })).toEqual({ valid: false, reason: "date" });
  expect(checkBirthday({ day: 1, month: 1, year: 2027 }, { now })).toEqual({ valid: false, reason: "date" });
});

test("with a year, the owner must be at least 16 (on their birthday they are)", () => {
  expect(checkBirthday({ day: 25, month: 11, year: 2010 }, { now })).toEqual({ valid: true });
  expect(checkBirthday({ day: 26, month: 11, year: 2010 }, { now })).toEqual({ valid: false, reason: "age" });
  expect(checkBirthday({ day: 1, month: 1, year: 2015 }, { now, minimumAge: 10 })).toEqual({ valid: true });
});

test("saves, shows and clears an account's birthday", async () => {
  expect(await accountBirthday(memory.database, { accountId })).toBeNull();
  expect(await setBirthday(memory.database, { accountId, birthday: { day: 3, month: 7 }, now })).toEqual({
    saved: true,
  });
  expect(await accountBirthday(memory.database, { accountId })).toEqual({ day: 3, month: 7, year: null });
  expect(await setBirthday(memory.database, { accountId, birthday: { day: 3, month: 7, year: 1990 }, now })).toEqual({
    saved: true,
  });
  expect(await accountBirthday(memory.database, { accountId })).toEqual({ day: 3, month: 7, year: 1990 });
  expect(await setBirthday(memory.database, { accountId, birthday: { day: 31, month: 2 }, now })).toEqual({
    saved: false,
    reason: "date",
  });
  expect(await setBirthday(memory.database, { accountId, birthday: null, now })).toEqual({ saved: true });
  expect(await accountBirthday(memory.database, { accountId })).toBeNull();
  const actions = await memory.database.selectFrom("audit_event").select("action").execute();
  expect(actions.filter(({ action }) => action === "account.birthday-changed")).toHaveLength(3);
});
