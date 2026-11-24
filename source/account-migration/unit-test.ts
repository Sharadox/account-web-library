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
const person = (identifier: string, email = `${identifier.toLowerCase()}@example.com`) =>
  memory.database.transaction().execute(async (transaction) => {
    const id = uuidVersion7();
    await transaction.insertInto("account").values({ id, kind: "person", name: "A Person", owner_id: null }).execute();
    await transaction
      .insertInto("identifier")
      .values({ id: uuidVersion7(), value: identifier, account_id: id })
      .execute();
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
  const applications = await memory.database.selectFrom("application").select(["id", "key"]).execute();
  expect(applications.map(({ key }) => key)).toEqual(["account"]);
  expect(applications[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  const tables = await sql<{
    name: string;
  }>`select table_name as name from information_schema.tables where table_schema = 'public' order by 1`.execute(
    memory.database,
  );
  expect(tables.rows.map(({ name }) => name)).toEqual([
    "account",
    "account_migration",
    "account_picture",
    "account_session",
    "application",
    "audit_event",
    "browser_session",
    "code_request",
    "contact",
    "identifier",
    "recovery_code",
    "totp_credential",
  ]);
});

test("identifiers are unique without regard to case", async () => {
  await person("abc");
  expect(await code(() => person("aBc", "other@example.com"))).toBe("identifier_value_key");
});

test("the database refuses identifiers outside the rules, as a last line behind checkIdentifier", async () => {
  for (const identifier of ["", "a--b", "-a", "a".repeat(51), "luís", "@luis"]) {
    expect(await code(() => person(identifier, "x@example.com"))).toBe("identifier_value_check");
  }
});

test("names have 1 to 50 characters, trimmed, with no control characters", async () => {
  for (const name of ["", " Luis", "a".repeat(51), "Luis\nPires"]) {
    expect(
      await code(() =>
        memory.database
          .insertInto("account")
          .values({ id: uuidVersion7(), kind: "person", name, owner_id: null })
          .execute(),
      ),
    ).toBe("account_name_check");
  }
});

test("every account keeps exactly one identifier, freed when the account goes", async () => {
  const id = await person("keeper");
  expect(await code(() => memory.database.deleteFrom("identifier").where("account_id", "=", id).execute())).toBe(
    "23514",
  );
  expect(
    await code(() =>
      memory.database
        .insertInto("identifier")
        .values({ id: uuidVersion7(), value: "second", account_id: id })
        .execute(),
    ),
  ).toBe("identifier_account_id_key");
  expect(
    await code(() =>
      memory.database
        .insertInto("identifier")
        .values({ id: uuidVersion7(), value: "nobody", account_id: null })
        .execute(),
    ),
  ).toBe("identifier_owner_check");
  await memory.database.deleteFrom("account").where("id", "=", id).execute();
  expect(await code(() => person("keeper"))).toBe("none");
});

test("every foreign key cascades updates and deletes, except where deleting must be refused", async () => {
  const keys = await sql<{ name: string; update: string; delete: string }>`select conname as name,
      confupdtype as update, confdeltype as delete from pg_constraint where contype = 'f' order by 1`.execute(
    memory.database,
  );
  expect(keys.rows).toEqual([
    { name: "account_owner_id_fkey", update: "c", delete: "c" },
    { name: "account_picture_account_id_fkey", update: "c", delete: "c" },
    { name: "account_session_account_id_fkey", update: "c", delete: "c" },
    { name: "account_session_browser_session_id_fkey", update: "c", delete: "c" },
    { name: "audit_event_application_id_fkey", update: "c", delete: "r" },
    { name: "code_request_account_id_fkey", update: "c", delete: "c" },
    { name: "contact_account_id_fkey", update: "c", delete: "c" },
    { name: "identifier_account_id_fkey", update: "c", delete: "c" },
    { name: "recovery_code_account_id_fkey", update: "c", delete: "c" },
    { name: "totp_credential_account_id_fkey", update: "c", delete: "c" },
  ]);
});

test("every table's id is a UUIDv7 primary key", async () => {
  const keys = await sql<{ table: string; key: string; type: string }>`select c.relname as table,
      a.attname as key, format_type(a.atttypid, a.atttypmod) as type
      from pg_index i join pg_class c on c.oid = i.indrelid
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      join pg_namespace n on n.oid = c.relnamespace
      where i.indisprimary and n.nspname = 'public' order by 1`.execute(memory.database);
  expect(keys.rows.every(({ key, type }) => key === "id" && type === "uuid")).toBe(true);
  expect(keys.rows.length).toBe(12);
});

test("ids must be UUID version 7", async () => {
  const id = "4b1f3c1e-5b4c-4d7e-9f2a-1c2b3d4e5f60"; // version 4
  expect(
    await code(() =>
      memory.database.insertInto("account").values({ id, kind: "person", name: "Version 4", owner_id: null }).execute(),
    ),
  ).toBe("account_id_check");
});

test("a person account can't exist without a verified sign-in contact", async () => {
  const alone = () =>
    memory.database
      .insertInto("account")
      .values({ id: uuidVersion7(), kind: "person", name: "Alone", owner_id: null })
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
  await memory.database.transaction().execute(async (transaction) => {
    await transaction
      .insertInto("account")
      .values({ id: agent, kind: "agent", name: "Helper", owner_id: owner })
      .execute();
    await transaction
      .insertInto("identifier")
      .values({ id: uuidVersion7(), value: "helper", account_id: agent })
      .execute();
  });
  expect(
    await code(() =>
      memory.database
        .insertInto("account")
        .values({ id: uuidVersion7(), kind: "agent", name: "Orphan", owner_id: null })
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
    .values({ id, account_id: null, actor_account_id: null, application_id: null, action: "test" })
    .execute();
  expect(
    await code(() => sql`update audit_event set action = 'changed' where id = ${id}`.execute(memory.database)),
  ).toBe("P0001");
  expect(await code(() => memory.database.deleteFrom("audit_event").where("id", "=", id).execute())).toBe("none");
});
