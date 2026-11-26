import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";
import {
  hasRecoveryCode,
  useRecoveryCode,
  verifyAuthenticatorCode,
} from "@sharadox/account-web-library/method-verification";
import { regenerateRecoveryCodes } from "@sharadox/account-web-library/recovery-code-regeneration";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { totpCode } from "@sharadox/account-web-library/totp";
import { confirmTotpSetup, startTotpSetup } from "@sharadox/account-web-library/totp-setup";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let accountId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  server = { database: memory.database, channels: [], secret: "a-root-secret-of-at-least-thirty-two-characters" };
  ({ accountId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

test("an authenticator's code works once; another account's or an unconfirmed authenticator's never", async () => {
  const setup = await startTotpSetup(server, { accountId, issuer: "Company" });
  if (setup.status !== "started") throw new Error(setup.status);
  const totp = decodeBase32(setup.secret);
  const code = totpCode(totp, 60_000);
  expect(await verifyAuthenticatorCode(server, { accountId, id: setup.id, code, now: 60_000 })).toBe(false);
  await confirmTotpSetup(server, { accountId, id: setup.id, code: totpCode(totp, 0), name: "Phone", now: 0 });
  const other = await createTestPerson(memory.database, "bia");
  expect(await verifyAuthenticatorCode(server, { accountId: other.accountId, id: setup.id, code, now: 60_000 })).toBe(
    false,
  );
  expect(await verifyAuthenticatorCode(server, { accountId, id: setup.id, code: "000 000", now: 60_000 })).toBe(false);
  expect(await verifyAuthenticatorCode(server, { accountId, id: setup.id, code, now: 60_000 })).toBe(true);
  expect(await verifyAuthenticatorCode(server, { accountId, id: setup.id, code })).toBe(false);
});

test("a recovery code works once, and whether any is left is known", async () => {
  expect(await hasRecoveryCode(server, accountId)).toBe(false);
  const setup = await startTotpSetup(server, { accountId, issuer: "Company" });
  if (setup.status !== "started") throw new Error(setup.status);
  const code = totpCode(decodeBase32(setup.secret), 0);
  await confirmTotpSetup(server, { accountId, id: setup.id, code, name: "Phone", now: 0 });
  const made = await regenerateRecoveryCodes(server, { accountId });
  if (made.status !== "made") throw new Error(made.status);
  expect(await hasRecoveryCode(server, accountId)).toBe(true);
  expect(await useRecoveryCode(server, { accountId, code: made.recoveryCodes[0]! })).toBe(true);
  expect(await useRecoveryCode(server, { accountId, code: made.recoveryCodes[0]!, now: 5 })).toBe(false);
});
