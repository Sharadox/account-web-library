import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { requestCode } from "@sharadox/account-web-library/code-request";
import { hashOneTimeCode } from "@sharadox/account-web-library/one-time-code";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

const pepper = "a-pepper-of-at-least-thirty-two-characters";
let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("creates an 8-digit code for a normalized contact, stored only as its hash, valid 10 minutes", async () => {
  const request = await requestCode(memory.database, {
    purpose: "sign-in",
    contact: { kind: "email", value: " Luis@Example.com" },
    pepper,
    now: 1_000,
  });
  expect(request.code).toMatch(/^\d{8}$/);
  expect(request.contact).toEqual({ kind: "email", value: "luis@example.com" });
  expect(request.expiresAt).toEqual(new Date(601_000));
  const row = await memory.database.selectFrom("code_request").selectAll().executeTakeFirstOrThrow();
  expect(row).toMatchObject({
    id: request.requestId,
    purpose: "sign-in",
    account_id: null,
    kind: "email",
    value: "luis@example.com",
    created_at: new Date(1_000),
    expires_at: new Date(601_000),
    attempts: 0,
    used_at: null,
    voided_at: null,
  });
  expect(row.code_hash).toBe(hashOneTimeCode(request.code, { pepper, purpose: `sign-in:${request.requestId}` }));
  expect(JSON.stringify(row)).not.toContain(request.code);
});

test("a new request voids the open ones for the same contact and purpose, and only those", async () => {
  const contact = { kind: "email", value: "a@example.com" };
  const first = await requestCode(memory.database, { purpose: "sign-in", contact, pepper, now: 1_000 });
  const other = await requestCode(memory.database, { purpose: "step-up", contact, pepper, now: 1_000 });
  const second = await requestCode(memory.database, { purpose: "sign-in", contact, pepper, now: 2_000 });
  const rows = await memory.database
    .selectFrom("code_request")
    .select(["id", "voided_at"])
    .orderBy("created_at")
    .orderBy("id")
    .execute();
  const voided = Object.fromEntries(rows.map(({ id, voided_at }) => [id, voided_at]));
  expect(voided[first.requestId]).toEqual(new Date(2_000));
  expect(voided[other.requestId]).toBeNull();
  expect(voided[second.requestId]).toBeNull();
});

test("takes the account, a length and a lifetime", async () => {
  const request = await requestCode(memory.database, {
    purpose: "step-up",
    accountId: "0198f5a2-7a4c-7000-8000-000000000001",
    contact: { kind: "email", value: "a@example.com" },
    pepper,
    length: 6,
    lifetimeSeconds: 60,
  });
  expect(request.code).toMatch(/^\d{6}$/);
  const row = await memory.database.selectFrom("code_request").selectAll().executeTakeFirstOrThrow();
  expect(row.account_id).toBe("0198f5a2-7a4c-7000-8000-000000000001");
  expect(row.expires_at.getTime() - row.created_at.getTime()).toBe(60_000);
});

test("refuses an unknown purpose", async () => {
  await expect(
    requestCode(memory.database, {
      purpose: "anything" as "sign-in",
      contact: { kind: "email", value: "a@example.com" },
      pepper,
    }),
  ).rejects.toThrow('unknown code purpose "anything"');
});
