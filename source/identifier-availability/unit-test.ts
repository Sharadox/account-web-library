import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { identifierAvailability } from "@sharadox/account-web-library/identifier-availability";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("says whether an identifier is available, taken in any case, or against the rules", async () => {
  await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "abc",
    contact: { kind: "email", value: "a@example.com" },
  });
  expect(await identifierAvailability(memory.database, "free")).toBe("available");
  expect(await identifierAvailability(memory.database, "ABC")).toBe("taken");
  expect(await identifierAvailability(memory.database, "a..b")).toBe("invalid");
});
