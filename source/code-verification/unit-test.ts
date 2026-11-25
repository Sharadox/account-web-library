import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { requestCode } from "@sharadox/account-web-library/code-request";
import { verifyCode } from "@sharadox/account-web-library/code-verification";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

const pepper = "a-pepper-of-at-least-thirty-two-characters";
const contact = { kind: "email", value: "a@example.com" };
let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

const start = (now = 1_000) => requestCode(memory.database, { purpose: "sign-in", contact, pepper, now });

test("the right code, once, gives back the contact and account", async () => {
  const { requestId, code } = await start();
  const typed = `${code.slice(0, 4)} ${code.slice(4)}`;
  expect(await verifyCode(memory.database, { requestId, code: typed, purpose: "sign-in", pepper, now: 2_000 })).toEqual(
    {
      valid: true,
      contact,
      accountId: null,
    },
  );
  expect(await verifyCode(memory.database, { requestId, code, purpose: "sign-in", pepper, now: 2_000 })).toEqual({
    valid: false,
    reason: "used",
  });
  // A used code keeps nobody's address: it was only needed to send the code.
  const row = await memory.database.selectFrom("code_request").select("value").executeTakeFirstOrThrow();
  expect(row.value).toBe("");
});

test("wrong codes count, and after 5 even the right one is refused", async () => {
  const { requestId, code } = await start();
  const wrong = code === "00000000" ? "11111111" : "00000000";
  for (let i = 0; i < 4; i++) {
    expect(
      await verifyCode(memory.database, { requestId, code: wrong, purpose: "sign-in", pepper, now: 2_000 }),
    ).toEqual({
      valid: false,
      reason: "wrong",
    });
  }
  expect(await verifyCode(memory.database, { requestId, code: wrong, purpose: "sign-in", pepper, now: 2_000 })).toEqual(
    {
      valid: false,
      reason: "attempts",
    },
  );
  expect(await verifyCode(memory.database, { requestId, code, purpose: "sign-in", pepper, now: 2_000 })).toEqual({
    valid: false,
    reason: "attempts",
  });
});

test("refuses expired, voided, unknown and other-purpose requests", async () => {
  const first = await start(1_000);
  expect(await verifyCode(memory.database, { ...first, purpose: "sign-in", pepper, now: 601_001 })).toEqual({
    valid: false,
    reason: "expired",
  });
  const second = await start(2_000);
  await start(3_000);
  expect(await verifyCode(memory.database, { ...second, purpose: "sign-in", pepper, now: 4_000 })).toEqual({
    valid: false,
    reason: "replaced",
  });
  expect(
    await verifyCode(memory.database, {
      requestId: "0198f5a2-7a4c-7000-8000-000000000009",
      code: "1",
      purpose: "sign-in",
      pepper,
    }),
  ).toEqual({ valid: false, reason: "unknown" });
  const third = await requestCode(memory.database, { purpose: "step-up", contact, pepper, now: 5_000 });
  expect(await verifyCode(memory.database, { ...third, purpose: "sign-in", pepper, now: 6_000 })).toEqual({
    valid: false,
    reason: "unknown",
  });
});

test("a malformed request id is simply unknown", async () => {
  expect(await verifyCode(memory.database, { requestId: "not-a-uuid", code: "1", purpose: "sign-in", pepper })).toEqual(
    {
      valid: false,
      reason: "unknown",
    },
  );
});

test("gives back the account that asked, and uses the current time by default", async () => {
  const created = await (
    await import("@sharadox/account-web-library/person-account")
  ).createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "asker",
    contact: { kind: "email", value: "asker@example.com" },
  });
  if (!created.created) throw new Error("not created");
  const { accountId } = created;
  const { requestId, code } = await requestCode(memory.database, { purpose: "step-up", accountId, contact, pepper });
  expect(await verifyCode(memory.database, { requestId, code, purpose: "step-up", pepper })).toEqual({
    valid: true,
    contact,
    accountId,
  });
});

test("concurrent guesses never get past the attempt limit", async () => {
  const { requestId, code } = await start();
  const wrong = code === "00000000" ? "11111111" : "00000000";
  await Promise.all(
    Array.from({ length: 10 }, () =>
      verifyCode(memory.database, { requestId, code: wrong, purpose: "sign-in", pepper, now: 2_000 }),
    ),
  );
  const row = await memory.database.selectFrom("code_request").select("attempts").executeTakeFirstOrThrow();
  expect(row.attempts).toBe(5);
});
