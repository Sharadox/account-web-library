import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { requestCode } from "@sharadox/account-web-library/code-request";
import { pruneCodeRequests } from "@sharadox/account-web-library/code-request-prune";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

const pepper = "a-pepper-of-at-least-thirty-two-characters";
let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("deletes requests that expired before the given time, contacts and all", async () => {
  await requestCode(memory.database, {
    purpose: "sign-in",
    contact: { kind: "email", value: "old@example.com" },
    pepper,
    now: 0,
  });
  await requestCode(memory.database, {
    purpose: "sign-in",
    contact: { kind: "email", value: "new@example.com" },
    pepper,
    now: 10_000_000,
  });
  expect(await pruneCodeRequests(memory.database, { before: new Date(5_000_000) })).toBe(1);
  expect(await memory.database.selectFrom("code_request").select("value").execute()).toEqual([
    { value: "new@example.com" },
  ]);
});
