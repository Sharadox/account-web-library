import { sql } from "kysely";
import { afterEach, beforeEach, expect, test } from "vitest";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountMigrations, migrateAccount } from "@sharadox/account-web-library/account-migration";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

/** A person with one verified email, in one transaction (the contact rule is checked at commit). */
const person = (username: string, email = `${username.toLowerCase()}@example.com`) =>
  memory.database.transaction().execute(async (transaction) => {
    const id = uuidVersion7();
    await transaction.insertInto("account").values({ id, kind: "person", username, owner_id: null }).execute();
    await transaction
      .insertInto("contact")
      .values({ id: uuidVersion7(), account_id: id, kind: "email", value: email, verified_at: new Date() })
      .execute();
    return id;
  });

const code = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    return (error as { code?: string; constraint?: string }).constraint ?? (error as { code?: string }).code;
  }
  return "none";
};

test("applies once, tracked in its own table, and knows the account application", async () => {
  expect(await migrateAccount(memory.database)).toEqual([]);
  expect(accountMigrations.length).toBeGreaterThan(0);
  expect(await memory.database.selectFrom("application").select("id").execute()).toEqual([{ id: "account" }]);
  const tables = await sql<{
    name: string;
  }>`select table_name as name from information_schema.tables where table_schema = 'public' order by 1`.execute(
    memory.database,
  );
  expect(tables.rows.map(({ name }) => name)).toEqual([
    "account",
    "account_migration",
    "application",
    "audit_event",
    "code_request",
    "contact",
  ]);
});

test("usernames are unique without regard to case", async () => {
  await person("abc");
  expect(await code(() => person("aBc", "other@example.com"))).toBe("account_username_key");
});

test("the database refuses usernames outside the rules, as a last line behind checkUsername", async () => {
  for (const username of ["", "a--b", "-a", "a".repeat(51), "luís"]) {
    expect(await code(() => person(username, "x@example.com"))).toBe("account_username_check");
  }
});

test("ids must be UUID version 7", async () => {
  const id = "4b1f3c1e-5b4c-4d7e-9f2a-1c2b3d4e5f60"; // version 4
  expect(
    await code(() =>
      memory.database.insertInto("account").values({ id, kind: "person", username: "v4", owner_id: null }).execute(),
    ),
  ).toBe("account_id_check");
});

test("a person account can't exist without a verified sign-in contact", async () => {
  const alone = () =>
    memory.database
      .insertInto("account")
      .values({ id: uuidVersion7(), kind: "person", username: "alone", owner_id: null })
      .execute();
  expect(await code(alone)).toBe("23514");
});

test("the last verified sign-in contact can't be removed, unverified, or stop allowing sign-in", async () => {
  const id = await person("luis");
  const contact = memory.database.selectFrom("contact").select("id").where("account_id", "=", id);
  const [{ id: contactId }] = (await contact.execute()) as [{ id: string }];
  expect(await code(() => memory.database.deleteFrom("contact").where("id", "=", contactId).execute())).toBe("23514");
  expect(
    await code(() =>
      memory.database.updateTable("contact").set({ verified_at: null }).where("id", "=", contactId).execute(),
    ),
  ).toBe("23514");
  expect(
    await code(() =>
      memory.database.updateTable("contact").set({ sign_in: false }).where("id", "=", contactId).execute(),
    ),
  ).toBe("23514");
  // With a second verified contact, the first can go.
  await memory.database
    .insertInto("contact")
    .values({ id: uuidVersion7(), account_id: id, kind: "email", value: "second@example.com", verified_at: new Date() })
    .execute();
  expect(await code(() => memory.database.deleteFrom("contact").where("id", "=", contactId).execute())).toBe("none");
});

test("a verified contact belongs to one account only; unverified claims don't block anyone", async () => {
  const first = await person("first", "shared@example.com");
  expect(await code(() => person("second", "shared@example.com"))).toBe("contact_verified");
  const other = await person("other");
  await memory.database
    .insertInto("contact")
    .values({ id: uuidVersion7(), account_id: other, kind: "email", value: "shared@example.com", verified_at: null })
    .execute();
  expect(first).toBeTruthy();
});

test("agents need an owner, people must not have one, and agents go with their owner", async () => {
  const owner = await person("owner");
  const agent = uuidVersion7();
  await memory.database
    .insertInto("account")
    .values({ id: agent, kind: "agent", username: "helper", owner_id: owner })
    .execute();
  expect(
    await code(() =>
      memory.database
        .insertInto("account")
        .values({ id: uuidVersion7(), kind: "agent", username: "orphan", owner_id: null })
        .execute(),
    ),
  ).toBe("account_owner_check");
  await memory.database.deleteFrom("account").where("id", "=", owner).execute();
  expect(await memory.database.selectFrom("account").select("id").execute()).toEqual([]);
  expect(await memory.database.selectFrom("contact").select("id").execute()).toEqual([]);
});

test("audit events can be added and deleted (retention) but never changed", async () => {
  const id = uuidVersion7();
  await memory.database
    .insertInto("audit_event")
    .values({ id, account_id: null, actor_account_id: null, application: null, action: "test" })
    .execute();
  expect(
    await code(() => sql`update audit_event set action = 'changed' where id = ${id}`.execute(memory.database)),
  ).toBe("P0001");
  expect(await code(() => memory.database.deleteFrom("audit_event").where("id", "=", id).execute())).toBe("none");
});
