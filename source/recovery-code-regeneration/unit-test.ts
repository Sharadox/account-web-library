import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";
import { regenerateRecoveryCodes } from "@sharadox/account-web-library/recovery-code-regeneration";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { totpCode } from "@sharadox/account-web-library/totp";
import { confirmTotpSetup, startTotpSetup, totpStatus } from "@sharadox/account-web-library/totp-setup";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let accountId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  server = { database: memory.database, channels: [], secret: "a-root-secret-of-at-least-thirty-two-characters" };
  ({ accountId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

test("makes 10 codes when asked, voiding any old ones, only with an authenticator on", async () => {
  expect(await regenerateRecoveryCodes(server, { accountId })).toEqual({ status: "second-factor-off" });
  const setup = await startTotpSetup(server, { accountId, issuer: "Company", name: "Phone" });
  if (setup.status !== "started") throw new Error(setup.status);
  await confirmTotpSetup(server, { accountId, id: setup.id, code: totpCode(decodeBase32(setup.secret), 0), now: 0 });
  const first = await regenerateRecoveryCodes(server, { accountId });
  if (first.status !== "made") throw new Error(first.status);
  const fresh = await regenerateRecoveryCodes(server, { accountId });
  if (fresh.status !== "made") throw new Error(fresh.status);
  expect(fresh.recoveryCodes).toHaveLength(10);
  expect(fresh.recoveryCodes).not.toContain(first.recoveryCodes[0]);
  expect(await totpStatus(server.database, { accountId })).toMatchObject({ recoveryCodesLeft: 10 });
  expect(await memory.database.selectFrom("recovery_code").select("id").execute()).toHaveLength(10);
});
