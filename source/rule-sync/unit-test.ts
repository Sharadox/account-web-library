import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { listRules, syncRules } from "@sharadox/account-web-library/rule-sync";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

const spam = {
  code: "spam",
  title: { en: "No spam", pt: "Sem spam" },
  description: { en: "Don't advertise.", pt: "Não faça publicidade." },
  schedule: [604_800, 2_592_000, "permanent" as const],
};

test("declares rules; an unchanged rule keeps its version, a changed one gets the next", async () => {
  expect(await syncRules(memory.database, { application: "account", rules: [spam] })).toEqual({ versioned: ["spam"] });
  expect(await syncRules(memory.database, { application: "account", rules: [spam] })).toEqual({ versioned: [] });
  await syncRules(memory.database, { application: "account", rules: [{ ...spam, schedule: [86_400] }] });
  expect(await listRules(memory.database, { application: "account" })).toEqual([
    { code: "spam", version: 2, title: spam.title, description: spam.description, schedule: [86_400], global: false },
  ]);
});

test("global rules apply everywhere and are listed with each application's own", async () => {
  await syncRules(memory.database, { application: null, rules: [{ ...spam, code: "respect" }] });
  await syncRules(memory.database, { application: "account", rules: [spam] });
  expect(
    (await listRules(memory.database, { application: "account" })).map(({ code, global }) => [code, global]),
  ).toEqual([
    ["respect", true],
    ["spam", false],
  ]);
  expect(await syncRules(memory.database, { application: "nowhere", rules: [spam] })).toEqual({
    versioned: [],
    unknownApplication: true,
  });
  expect(await listRules(memory.database, { application: "nowhere" })).toEqual([
    expect.objectContaining({ code: "respect" }),
  ]);
});
